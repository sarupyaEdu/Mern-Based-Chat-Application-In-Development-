import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  buildTwoFactorKeyUri,
  buildTwoFactorQrCodeDataUrl,
  generateTwoFactorSecret,
} from "@/lib/two-factor";
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

    const user = await User.findById(session.user.id).select(
      "email phone twoFactorEnabled twoFactorTempSecret",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, message: "Two-factor authentication is already enabled" },
        { status: 409 },
      );
    }

    const secret = generateTwoFactorSecret();
    const accountName = user.email || user.phone || session.user.id;
    const otpauthUrl = buildTwoFactorKeyUri({
      accountName,
      secret,
    });
    const qrCodeDataUrl = await buildTwoFactorQrCodeDataUrl(otpauthUrl);

    user.twoFactorTempSecret = secret;
    await user.save();

    return NextResponse.json({
      success: true,
      setup: {
        qrCodeDataUrl,
        manualKey: secret,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate 2FA setup",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
