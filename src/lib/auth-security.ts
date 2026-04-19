import "server-only";

import bcrypt from "bcryptjs";
import {
  isEmailConfigured,
  sendEmailVerificationOtpEmail,
} from "@/lib/mailer";
import EmailVerificationOtp from "@/models/EmailVerificationOtp";

export function createOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export function calculateLockDurationMs(attempts: number) {
  if (attempts < 5) return 0;
  const exponent = Math.min(attempts - 5, 6);
  return 60_000 * 2 ** exponent;
}

export async function issueEmailVerificationOtp({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const existingOtp = await EmailVerificationOtp.findOne({ userId });

  if (
    existingOtp &&
    existingOtp.createdAt &&
    Date.now() - existingOtp.createdAt.getTime() < 60_000
  ) {
    return {
      success: true,
      message: "A verification OTP was sent recently. Please wait a minute and try again.",
    };
  }

  const otp = createOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await EmailVerificationOtp.findOneAndUpdate(
    { userId },
    {
      userId,
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
    await sendEmailVerificationOtpEmail({
      to: email,
      otp,
    });
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`DEV email verification OTP for ${email}: ${otp}`);
  } else {
    throw new Error("Email verification mail is not configured");
  }

  return {
    success: true,
    message: "Verification OTP sent to your email.",
    ...(canSendEmail || process.env.NODE_ENV === "production"
      ? {}
      : { devOtp: otp }),
  };
}
