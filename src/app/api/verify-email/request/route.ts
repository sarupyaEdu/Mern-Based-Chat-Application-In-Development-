import { NextResponse } from "next/server";
import { z } from "zod";
import { issueEmailVerificationOtp } from "@/lib/auth-security";
import { connectDB } from "@/lib/db";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import User from "@/models/User";

const requestSchema = z.object({
  identifier: z.string().min(3),
});

const genericVerificationResponse = {
  success: true,
  message:
    "If the account exists and still needs verification, a verification OTP has been sent.",
};

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `verify-email-request:${clientIp}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many verification requests. Try again later." },
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
    }).select("email emailVerified");

    if (!user) {
      return NextResponse.json(genericVerificationResponse);
    }

    if (user.emailVerified) {
      return NextResponse.json(genericVerificationResponse);
    }

    const result = await issueEmailVerificationOtp({
      userId: user._id.toString(),
      email: user.email,
    });

    return NextResponse.json({
      ...genericVerificationResponse,
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send verification OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
