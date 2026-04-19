import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EMAIL_NOT_VERIFIED_ERROR,
  GENERIC_AUTH_ERROR,
} from "@/lib/auth-constants";
import {
  calculateLockDurationMs,
} from "@/lib/auth-security";
import {
  createSessionForUser,
  getSessionCookieOptions,
} from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  TWO_FACTOR_CHALLENGE_COOKIE_NAME,
} from "@/lib/auth-config";
import { connectDB } from "@/lib/db";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/two-factor";
import AuthChallenge from "@/models/AuthChallenge";
import User from "@/models/User";

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `login:${clientIp}`,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: GENERIC_AUTH_ERROR },
        { status: 400 },
      );
    }

    const identifier = parsed.data.identifier.trim();
    const rememberMe = Boolean(parsed.data.rememberMe);
    const normalizedIdentifier = identifier.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { phone: identifier }],
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: GENERIC_AUTH_ERROR },
        { status: 401 },
      );
    }

    const isLocked =
      user.lockUntil instanceof Date && user.lockUntil.getTime() > Date.now();

    if (isLocked) {
      return NextResponse.json(
        { success: false, message: GENERIC_AUTH_ERROR },
        { status: 401 },
      );
    }

    const isMatch = await bcrypt.compare(parsed.data.password, user.password);

    if (!isMatch) {
      const nextAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockDurationMs = calculateLockDurationMs(nextAttempts);

      user.failedLoginAttempts = nextAttempts;
      user.lockUntil =
        lockDurationMs > 0 ? new Date(Date.now() + lockDurationMs) : null;
      await user.save();

      return NextResponse.json(
        { success: false, message: GENERIC_AUTH_ERROR },
        { status: 401 },
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, message: EMAIL_NOT_VERIFIED_ERROR },
        { status: 403 },
      );
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const challengeToken = createOpaqueToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await AuthChallenge.create({
        tokenHash: hashOpaqueToken(challengeToken),
        userId: user._id,
        purpose: "login-2fa",
        attempts: 0,
        rememberMe,
        expiresAt,
      });

      const response = NextResponse.json({
        success: true,
        twoFactorRequired: true,
        message: "Enter the 6-digit code from your authenticator app",
      });

      response.cookies.set(TWO_FACTOR_CHALLENGE_COOKIE_NAME, challengeToken, {
        ...getSessionCookieOptions(expiresAt),
        sameSite: "strict",
      });

      return response;
    }

    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const { token, expiresAt } = await createSessionForUser(
      user._id.toString(),
      rememberMe,
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
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(expiresAt),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Login failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
