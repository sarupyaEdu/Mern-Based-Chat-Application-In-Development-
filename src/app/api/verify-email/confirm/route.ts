import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import EmailVerificationOtp from "@/models/EmailVerificationOtp";
import User from "@/models/User";

const confirmSchema = z.object({
  identifier: z.string().min(3),
  otp: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `verify-email-confirm:${clientIp}`,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many verification attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Valid identifier and OTP are required" },
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
        { success: false, message: "Invalid verification request" },
        { status: 400 },
      );
    }

    const verificationEntry = await EmailVerificationOtp.findOne({
      userId: user._id,
    });

    if (!verificationEntry || verificationEntry.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, message: "OTP expired or not found" },
        { status: 400 },
      );
    }

    if (verificationEntry.attempts >= 5) {
      await EmailVerificationOtp.deleteOne({ _id: verificationEntry._id });
      return NextResponse.json(
        { success: false, message: "Too many invalid attempts. Request a new OTP." },
        { status: 429 },
      );
    }

    const isValidOtp = await bcrypt.compare(parsed.data.otp, verificationEntry.otpHash);

    if (!isValidOtp) {
      verificationEntry.attempts += 1;
      await verificationEntry.save();

      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 },
      );
    }

    user.emailVerified = true;
    await user.save();
    await EmailVerificationOtp.deleteMany({ userId: user._id });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully. You can log in now.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify email",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
