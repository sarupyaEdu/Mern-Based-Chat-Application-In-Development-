import { NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  invalidateSessionToken,
} from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  TWO_FACTOR_CHALLENGE_COOKIE_NAME,
} from "@/lib/auth-config";

export async function POST(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (token) {
    await invalidateSessionToken(token);
  }

  const response = NextResponse.json({
    success: true,
    message: "Logged out",
  });

  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    getSessionCookieOptions(new Date(0)),
  );
  response.cookies.set(
    TWO_FACTOR_CHALLENGE_COOKIE_NAME,
    "",
    getSessionCookieOptions(new Date(0)),
  );

  return response;
}
