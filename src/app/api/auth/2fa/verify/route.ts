import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createSessionForUser,
  getSessionCookieOptions,
} from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  TWO_FACTOR_CHALLENGE_COOKIE_NAME,
} from "@/lib/auth-config";
import { connectDB } from "@/lib/db";
import { verifyTwoFactorOtp, hashOpaqueToken } from "@/lib/two-factor";
import AuthChallenge from "@/models/AuthChallenge";
import User from "@/models/User";

const verifySchema = z.object({
  otp: z.string().length(6),
  method: z.enum(["authenticator", "email"]).default("authenticator"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Enter a valid 6-digit code" },
        { status: 400 },
      );
    }

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

    if (challenge.attempts >= 5) {
      await AuthChallenge.deleteOne({ _id: challenge._id });
      const blockedResponse = NextResponse.json(
        { success: false, message: "Too many invalid codes. Sign in again." },
        { status: 429 },
      );
      blockedResponse.cookies.set(
        TWO_FACTOR_CHALLENGE_COOKIE_NAME,
        "",
        getSessionCookieOptions(new Date(0)),
      );
      return blockedResponse;
    }

    const user = await User.findById(challenge.userId).select(
      "name email phone avatar twoFactorEnabled twoFactorSecret",
    );

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      await AuthChallenge.deleteOne({ _id: challenge._id });
      const invalidResponse = NextResponse.json(
        { success: false, message: "Two-factor authentication is no longer available for this account." },
        { status: 400 },
      );
      invalidResponse.cookies.set(
        TWO_FACTOR_CHALLENGE_COOKIE_NAME,
        "",
        getSessionCookieOptions(new Date(0)),
      );
      return invalidResponse;
    }

    let isValidOtp = false;

    if (parsed.data.method === "email") {
      if (
        !challenge.emailOtpHash ||
        !challenge.emailOtpExpiresAt ||
        challenge.emailOtpExpiresAt.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { success: false, message: "Your email OTP expired. Request a new one." },
          { status: 400 },
        );
      }

      isValidOtp = await bcrypt.compare(parsed.data.otp, challenge.emailOtpHash);
    } else {
      isValidOtp = await verifyTwoFactorOtp({
        token: parsed.data.otp,
        secret: user.twoFactorSecret,
      });
    }

    if (!isValidOtp) {
      challenge.attempts += 1;
      await challenge.save();
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

    await AuthChallenge.deleteOne({ _id: challenge._id });

    const { token, expiresAt } = await createSessionForUser(
      user._id.toString(),
      Boolean(challenge.rememberMe),
    );
    const response = NextResponse.json({
      success: true,
      session: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          image: user.avatar || "",
        },
      },
    });

    response.cookies.set(
      TWO_FACTOR_CHALLENGE_COOKIE_NAME,
      "",
      getSessionCookieOptions(new Date(0)),
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(expiresAt),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify 2FA",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
