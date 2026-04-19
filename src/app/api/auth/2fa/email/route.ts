import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOtp } from "@/lib/auth-security";
import { getSessionCookieOptions } from "@/lib/auth";
import { TWO_FACTOR_CHALLENGE_COOKIE_NAME } from "@/lib/auth-config";
import { connectDB } from "@/lib/db";
import {
  isEmailConfigured,
  sendLoginTwoFactorOtpEmail,
} from "@/lib/mailer";
import { hashOpaqueToken } from "@/lib/two-factor";
import AuthChallenge from "@/models/AuthChallenge";
import User from "@/models/User";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const challengeToken = cookieStore.get(TWO_FACTOR_CHALLENGE_COOKIE_NAME)?.value;

    if (!challengeToken) {
      return NextResponse.json(
        { success: false, message: "Your 2FA login session expired. Sign in again." },
        { status: 401 },
      );
    }

    await connectDB();

    const challenge = await AuthChallenge.findOne({
      tokenHash: hashOpaqueToken(challengeToken),
      purpose: "login-2fa",
    });

    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      if (challenge) {
        await AuthChallenge.deleteOne({ _id: challenge._id });
      }

      const expiredResponse = NextResponse.json(
        { success: false, message: "Your 2FA login session expired. Sign in again." },
        { status: 401 },
      );
      expiredResponse.cookies.set(
        TWO_FACTOR_CHALLENGE_COOKIE_NAME,
        "",
        getSessionCookieOptions(new Date(0)),
      );
      return expiredResponse;
    }

    if (
      challenge.emailOtpSentAt &&
      Date.now() - challenge.emailOtpSentAt.getTime() < 60_000
    ) {
      return NextResponse.json({
        success: true,
        message: "An email OTP was sent recently. Please wait a minute and try again.",
      });
    }

    const user = await User.findById(challenge.userId).select("email");

    if (!user?.email) {
      return NextResponse.json(
        { success: false, message: "No email address is available for this account." },
        { status: 400 },
      );
    }

    const otp = createOtp();
    challenge.emailOtpHash = await bcrypt.hash(otp, 10);
    challenge.emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    challenge.emailOtpSentAt = new Date();
    await challenge.save();

    const canSendEmail = isEmailConfigured();

    if (canSendEmail) {
      await sendLoginTwoFactorOtpEmail({
        to: user.email,
        otp,
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`DEV login 2FA OTP for ${user.email}: ${otp}`);
    } else {
      return NextResponse.json(
        { success: false, message: "Login email OTP is not configured" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `A login OTP has been sent to ${user.email}.`,
      ...(canSendEmail || process.env.NODE_ENV === "production"
        ? {}
        : { devOtp: otp }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send login OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
