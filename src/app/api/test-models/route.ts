import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, message: "Not available in production" },
        { status: 404 },
      );
    }

    await connectDB();

    return NextResponse.json({
      success: true,
      message: "All models loaded successfully",
      models: {
        user: !!User,
        conversation: !!Conversation,
        message: !!Message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Model loading failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
