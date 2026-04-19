import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { rpID, rpName } from "@/lib/webauthn";
import Passkey from "@/models/Passkey";
import WebAuthnChallenge from "@/models/WebAuthnChallenge";
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

    const user = await User.findById(session.user.id).select("name email");

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const existingPasskeys = await Passkey.find({ userId: user._id }).select(
      "credentialID transports",
    );

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user._id.toString(),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialID,
        transports: passkey.transports,
      })),
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      type: "registration",
      userId: user._id,
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
        message: "Failed to generate passkey registration options",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
