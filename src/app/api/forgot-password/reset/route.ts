import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isStrongPassword, passwordSchemaRule } from "@/lib/auth-constants";
import { invalidateAllSessionsForUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import PasswordResetOtp from "@/models/PasswordResetOtp";
import User from "@/models/User";

const resetSchema = z.object({
  identifier: z.string().min(3),
  otp: z.string().length(6),
  password: z.string().min(8).refine(isStrongPassword, passwordSchemaRule),
});

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `forgot-password-reset:${clientIp}`,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many reset attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Identifier, OTP and new password are required" },
        { status: 400 },
      );
    }
    const identifier = parsed.data.identifier.trim();
    const normalizedIdentifier = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { phone: identifier }],
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP or account" },
        { status: 400 },
      );
    }

    const resetEntry = await PasswordResetOtp.findOne({ userId: user._id });

    if (!resetEntry || resetEntry.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, message: "OTP expired or not found" },
        { status: 400 },
      );
    }

    if (resetEntry.attempts >= 5) {
      await PasswordResetOtp.deleteOne({ _id: resetEntry._id });
      return NextResponse.json(
        { success: false, message: "Too many invalid attempts. Request a new OTP." },
        { status: 429 },
      );
    }

    const isValidOtp = await bcrypt.compare(parsed.data.otp, resetEntry.otpHash);

    if (!isValidOtp) {
      resetEntry.attempts += 1;
      await resetEntry.save();

      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 },
      );
    }

    user.password = await bcrypt.hash(parsed.data.password, 10);
    await user.save();
    await invalidateAllSessionsForUser(user._id.toString());
    await PasswordResetOtp.deleteMany({ userId: user._id });

    return NextResponse.json({
      success: true,
      message: "Password reset successful. You can log in now.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset password",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
