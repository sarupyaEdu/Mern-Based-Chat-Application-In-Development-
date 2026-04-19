import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth-config";
import { connectDB } from "@/lib/db";
import AuthSession from "@/models/AuthSession";
import User from "@/models/User";

const isProduction = process.env.NODE_ENV === "production";
const sessionMaxAgeMs = 1000 * 60 * 60 * 12;
const rememberedSessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    image?: string;
  };
};

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRawSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getSessionExpiryDate(rememberMe = false) {
  return new Date(
    Date.now() + (rememberMe ? rememberedSessionMaxAgeMs : sessionMaxAgeMs),
  );
}

export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    expires,
  };
}

export async function createSessionForUser(userId: string, rememberMe = false) {
  await connectDB();

  const token = createRawSessionToken();
  const expiresAt = getSessionExpiryDate(rememberMe);

  await AuthSession.create({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function invalidateSessionToken(token: string) {
  await connectDB();
  await AuthSession.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function invalidateAllSessionsForUser(userId: string) {
  await connectDB();
  await AuthSession.deleteMany({ userId });
}

export async function auth(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  await connectDB();

  const tokenHash = hashSessionToken(token);
  const sessionRecord = await AuthSession.findOne({ tokenHash });

  if (!sessionRecord) {
    return null;
  }

  if (sessionRecord.expiresAt.getTime() <= Date.now()) {
    await AuthSession.deleteOne({ _id: sessionRecord._id });
    return null;
  }

  const user = await User.findById(sessionRecord.userId).select(
    "name email phone avatar",
  );

  if (!user) {
    await AuthSession.deleteOne({ _id: sessionRecord._id });
    return null;
  }

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.avatar || "",
    },
  };
}
