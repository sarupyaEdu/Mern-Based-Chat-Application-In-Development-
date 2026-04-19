import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOtp } from "@/lib/auth-security";
import { connectDB } from "@/lib/db";
import {
  isEmailConfigured,
  sendDisableTwoFactorOtpEmail,
} from "@/lib/mailer";
import TwoFactorDisableOtp from "@/models/TwoFactorDisableOtp";
import User from "@/models/User";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const user = await User.findById(session.user.id).select(
      "email twoFactorEnabled twoFactorSecret",
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

    if (!user.email) {
      return NextResponse.json(
        { success: false, message: "No email address is available for this account." },
        { status: 400 },
      );
    }

    const existingOtp = await TwoFactorDisableOtp.findOne({ userId: user._id });

    if (
      existingOtp?.createdAt &&
      Date.now() - existingOtp.createdAt.getTime() < 60_000
    ) {
      return NextResponse.json({
        success: true,
        message: "A disable-2FA OTP was sent recently. Please wait a minute and try again.",
      });
    }

    const otp = createOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await TwoFactorDisableOtp.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        otpHash,
        expiresAt,
        attempts: 0,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    const canSendEmail = isEmailConfigured();

    if (canSendEmail) {
      await sendDisableTwoFactorOtpEmail({
        to: user.email,
        otp,
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`DEV disable 2FA OTP for ${user.email}: ${otp}`);
    } else {
      return NextResponse.json(
        { success: false, message: "Disable 2FA email OTP is not configured" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `A disable-2FA OTP has been sent to ${user.email}.`,
      ...(canSendEmail || process.env.NODE_ENV === "production"
        ? {}
        : { devOtp: otp }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send disable-2FA OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
