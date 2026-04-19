import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getExpectedOrigins, rpID } from "@/lib/webauthn";
import Passkey from "@/models/Passkey";
import WebAuthnChallenge from "@/models/WebAuthnChallenge";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as RegistrationResponseJSON;
    await connectDB();

    const user = await User.findById(session.user.id).select("_id");

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const challenge = await WebAuthnChallenge.findOne({
      userId: user._id,
      type: "registration",
    }).sort({ createdAt: -1 });

    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, message: "Passkey setup expired. Start again." },
        { status: 400 },
      );
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { success: false, message: "Passkey registration could not be verified" },
        { status: 400 },
      );
    }

    const registrationInfo = verification.registrationInfo;
    const credentialID = Buffer.from(registrationInfo.credentialID).toString(
      "base64url",
    );

    const existingPasskey = await Passkey.findOne({ credentialID });
    if (existingPasskey) {
      await WebAuthnChallenge.deleteMany({
        userId: user._id,
        type: "registration",
      });
      return NextResponse.json({
        success: true,
        message: "Passkey already saved for this account",
      });
    }

    await Passkey.create({
      userId: user._id,
      credentialID,
      publicKey: Buffer.from(registrationInfo.credentialPublicKey),
      counter: registrationInfo.counter,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: body.response.transports || [],
    });

    await WebAuthnChallenge.deleteMany({
      userId: user._id,
      type: "registration",
    });

    return NextResponse.json({
      success: true,
      message: "Passkey saved successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify passkey registration",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
