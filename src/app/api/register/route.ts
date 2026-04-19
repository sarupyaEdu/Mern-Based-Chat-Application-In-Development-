import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isStrongPassword, passwordSchemaRule } from "@/lib/auth-constants";
import {
  issueEmailVerificationOtp,
} from "@/lib/auth-security";
import { connectDB } from "@/lib/db";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import User from "@/models/User";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(8, "Phone must be at least 8 digits").max(20),
  password: z
    .string()
    .min(8, passwordSchemaRule)
    .refine(isStrongPassword, passwordSchemaRule),
});

export async function POST(req: Request) {
  try {
    await connectDB();

    const clientIp = getClientIpFromHeaders(req.headers);
    const rateLimit = await enforceRateLimit({
      key: `register:${clientIp}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many registration attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { name, email, phone, password } = parsed.data;
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "An account already exists with these details",
        },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      emailVerified: false,
    });

    const verificationResult = await issueEmailVerificationOtp({
      userId: user._id.toString(),
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully. Verify your email to continue.",
        requiresEmailVerification: true,
        ...(verificationResult.devOtp ? { devOtp: verificationResult.devOtp } : {}),
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Registration failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
