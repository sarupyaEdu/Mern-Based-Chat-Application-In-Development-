import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import {
  createSessionForUser,
  getSessionCookieOptions,
} from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-config";
import { connectDB } from "@/lib/db";
import { getExpectedOrigins, rpID } from "@/lib/webauthn";
import Passkey from "@/models/Passkey";
import User from "@/models/User";
import WebAuthnChallenge from "@/models/WebAuthnChallenge";

const validAuthenticatorTransports = new Set<AuthenticatorTransportFuture>([
  "ble",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AuthenticationResponseJSON;
    await connectDB();

    const challenge = await WebAuthnChallenge.findOne({
      type: "authentication",
    }).sort({ createdAt: -1 });

    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, message: "Passkey sign-in expired. Try again." },
        { status: 400 },
      );
    }

    const credentialID = body.id;
    const passkey = await Passkey.findOne({ credentialID });

    if (!passkey) {
      return NextResponse.json(
        { success: false, message: "No passkey matched this device credential" },
        { status: 404 },
      );
    }

    const transports = Array.isArray(passkey.transports)
      ? passkey.transports.filter(
          (
            transport,
          ): transport is AuthenticatorTransportFuture =>
            validAuthenticatorTransports.has(
              transport as AuthenticatorTransportFuture,
            ),
        )
      : undefined;

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: rpID,
      authenticator: {
        credentialID: Uint8Array.from(
          Buffer.from(passkey.credentialID, "base64url"),
        ),
        credentialPublicKey: Uint8Array.from(passkey.publicKey),
        counter: passkey.counter,
        transports: transports?.length ? transports : undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, message: "Passkey verification failed" },
        { status: 400 },
      );
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    await passkey.save();

    const user = await User.findById(passkey.userId).select(
      "name email phone avatar",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    await WebAuthnChallenge.deleteMany({ type: "authentication" });

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
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(expiresAt),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify passkey sign-in",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
