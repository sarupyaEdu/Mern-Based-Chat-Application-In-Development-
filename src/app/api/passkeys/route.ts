import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Passkey from "@/models/Passkey";

const deleteSchema = z.object({
  credentialID: z.string().min(1),
});

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const passkeys = await Passkey.find({ userId: session.user.id })
      .select("credentialID deviceType backedUp transports createdAt")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      passkeys: passkeys.map((passkey) => ({
        credentialID: passkey.credentialID,
        label: `Credential ending ${passkey.credentialID.slice(-6)}`,
        deviceType: passkey.deviceType || "unknown",
        backedUp: Boolean(passkey.backedUp),
        transports: passkey.transports || [],
        createdAt: passkey.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load saved passkeys",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Credential ID is required" },
        { status: 400 },
      );
    }

    await connectDB();

    const deleted = await Passkey.findOneAndDelete({
      userId: session.user.id,
      credentialID: parsed.data.credentialID,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Saved passkey not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Saved passkey removed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove saved passkey",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
