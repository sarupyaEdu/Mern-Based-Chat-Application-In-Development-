import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { verifyTwoFactorOtp } from "@/lib/two-factor";
import User from "@/models/User";

const enableSchema = z.object({
  otp: z.string().length(6),
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
    const parsed = enableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Enter a valid 6-digit code" },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findById(session.user.id).select(
      "twoFactorEnabled twoFactorTempSecret",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (!user.twoFactorTempSecret) {
      return NextResponse.json(
        { success: false, message: "Start 2FA setup first" },
        { status: 400 },
      );
    }

    const isValid = await verifyTwoFactorOtp({
      token: parsed.data.otp,
      secret: user.twoFactorTempSecret,
    });

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid authenticator code" },
        { status: 400 },
      );
    }

    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = "";
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication enabled",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to enable 2FA",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
