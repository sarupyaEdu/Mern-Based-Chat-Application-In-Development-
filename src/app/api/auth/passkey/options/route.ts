import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { connectDB } from "@/lib/db";
import { rpID } from "@/lib/webauthn";
import WebAuthnChallenge from "@/models/WebAuthnChallenge";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      rememberMe?: boolean;
    };

    await connectDB();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      type: "authentication",
      rememberMe: Boolean(body.rememberMe),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate passkey login options",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
