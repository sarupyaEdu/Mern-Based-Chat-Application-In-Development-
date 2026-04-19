import "server-only";

import crypto from "crypto";
import QRCode from "qrcode";
import {
  generateSecret as generateBase32Secret,
  NobleCryptoPlugin,
  ScureBase32Plugin,
  TOTP,
} from "otplib";
import { AUTHENTICATOR_ISSUER_NAME } from "@/lib/auth-config";

const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();

const totp = new TOTP({
  crypto: cryptoPlugin,
  base32: base32Plugin,
});

export function generateTwoFactorSecret() {
  // 16 bytes stays RFC-safe while producing a shorter Base32 key for Authy-style manual entry.
  return generateBase32Secret({
    crypto: cryptoPlugin,
    base32: base32Plugin,
    length: 16,
  });
}

export function buildTwoFactorKeyUri({
  accountName,
  secret,
}: {
  accountName: string;
  secret: string;
}) {
  return totp.toURI({
    issuer: AUTHENTICATOR_ISSUER_NAME,
    label: accountName,
    secret,
  });
}

export async function buildTwoFactorQrCodeDataUrl(otpauthUrl: string) {
  return QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 220,
  });
}

export async function verifyTwoFactorOtp({
  token,
  secret,
}: {
  token: string;
  secret: string;
}) {
  const result = await totp.verify(token, {
    secret,
    epochTolerance: 30,
  });

  return result.valid;
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
