import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { verifyTwoFactorOtp } from "@/lib/two-factor";
import TwoFactorDisableOtp from "@/models/TwoFactorDisableOtp";
import User from "@/models/User";

const disableSchema = z.object({
  otp: z.string().length(6),
  method: z.enum(["authenticator", "email"]).default("authenticator"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = disableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Enter a valid 6-digit code" },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findById(session.user.id).select(
      "twoFactorEnabled twoFactorSecret twoFactorTempSecret",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, message: "Two-factor authentication is not enabled" },
        { status: 400 },
      );
    }

    let isValid = false;

    if (parsed.data.method === "email") {
      const disableEntry = await TwoFactorDisableOtp.findOne({ userId: user._id });

      if (!disableEntry || disableEntry.expiresAt.getTime() <= Date.now()) {
        if (disableEntry) {
          await TwoFactorDisableOtp.deleteOne({ _id: disableEntry._id });
        }

        return NextResponse.json(
          { success: false, message: "Your email OTP expired. Request a new one." },
          { status: 400 },
        );
      }

      if (disableEntry.attempts >= 5) {
        await TwoFactorDisableOtp.deleteOne({ _id: disableEntry._id });
        return NextResponse.json(
          { success: false, message: "Too many invalid email OTP attempts. Request a new one." },
          { status: 429 },
        );
      }

      isValid = await bcrypt.compare(parsed.data.otp, disableEntry.otpHash);

      if (!isValid) {
        disableEntry.attempts += 1;
        await disableEntry.save();
      }
    } else {
      isValid = await verifyTwoFactorOtp({
        token: parsed.data.otp,
        secret: user.twoFactorSecret,
      });
    }

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsed.data.method === "email"
              ? "Invalid email OTP"
              : "Invalid authenticator code",
        },
        { status: 400 },
      );
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = "";
    user.twoFactorTempSecret = "";
    await user.save();
    await TwoFactorDisableOtp.deleteMany({ userId: user._id });

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication disabled",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to disable 2FA",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
