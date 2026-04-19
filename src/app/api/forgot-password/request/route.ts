import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import {
  isEmailConfigured,
  sendPasswordResetOtpEmail,
} from "@/lib/mailer";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import PasswordResetOtp from "@/models/PasswordResetOtp";
import User from "@/models/User";

const requestSchema = z.object({
  identifier: z.string().min(3),
});

function createOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `forgot-password-request:${clientIp}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many OTP requests. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Email or phone number is required" },
        { status: 400 },
      );
    }
    const identifier = parsed.data.identifier.trim();
    const normalizedIdentifier = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { phone: identifier }],
    }).select("email");

    const genericResponse = {
      success: true,
      message:
        "If an account exists, an OTP has been sent to the registered email.",
    };

    if (!user?.email) {
      return NextResponse.json(genericResponse);
    }

    const existingOtp = await PasswordResetOtp.findOne({ userId: user._id });

    if (
      existingOtp &&
      existingOtp.createdAt &&
      Date.now() - existingOtp.createdAt.getTime() < 60_000
    ) {
      return NextResponse.json({
        success: true,
        message: "An OTP was sent recently. Please wait a minute and try again.",
      });
    }

    const otp = createOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordResetOtp.findOneAndUpdate(
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
      await sendPasswordResetOtpEmail({
        to: user.email,
        otp,
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`DEV password reset OTP for ${user.email}: ${otp}`);
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Password reset email is not configured",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...genericResponse,
      ...(canSendEmail || process.env.NODE_ENV === "production"
        ? {}
        : { devOtp: otp }),
    });
  } catch (error) {
    console.error("POST /api/forgot-password/request error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
