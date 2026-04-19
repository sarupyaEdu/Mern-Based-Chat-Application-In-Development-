import { NextResponse } from "next/server";
import {
  auth,
  getSessionCookieOptions,
} from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-config";

export async function GET() {
  const session = await auth();

  if (!session) {
    const response = NextResponse.json(
      { success: false, message: "Unauthenticated" },
      { status: 401 },
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      "",
      getSessionCookieOptions(new Date(0)),
    );
    return response;
  }

  return NextResponse.json({
    success: true,
    session,
  });
}
