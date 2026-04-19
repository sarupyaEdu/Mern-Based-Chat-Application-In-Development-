import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { deleteChatMedia, uploadProfileAvatar } from "@/lib/chat-media";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

const profileSchema = z.object({
  avatar: z.string().max(8_000_000).optional(),
  bio: z.string().max(240).optional(),
  status: z.string().max(80).optional(),
  phone: z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().min(8).max(20).optional()),
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

    const user = await User.findById(session.user.id).select(
      "name email phone avatar bio status twoFactorEnabled",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      profile: user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch profile",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid profile data",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    await connectDB();

    const normalizedPhone = parsed.data.phone?.trim() || "";

    const currentUser = await User.findById(session.user.id).select(
      "avatar avatarPublicId",
    );

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const nextAvatarInput = parsed.data.avatar ?? "";
    const shouldUploadAvatar =
      nextAvatarInput.startsWith("data:") &&
      nextAvatarInput !== (currentUser.avatar || "");
    const uploadedAvatar = shouldUploadAvatar
      ? await uploadProfileAvatar(nextAvatarInput)
      : null;

    const updateData: {
      avatar: string;
      avatarPublicId?: string;
      bio: string;
      status: string;
      phone?: string;
      $unset?: { phone?: 1; avatarPublicId?: 1 };
    } = {
      avatar: uploadedAvatar?.avatar || nextAvatarInput,
      bio: parsed.data.bio ?? "",
      status: parsed.data.status?.trim() || "Available",
    };

    if (uploadedAvatar?.avatarPublicId) {
      updateData.avatarPublicId = uploadedAvatar.avatarPublicId;
    } else if (!nextAvatarInput && currentUser.avatarPublicId) {
      updateData.$unset = {
        ...(updateData.$unset || {}),
        avatarPublicId: 1,
      };
    }

    if (normalizedPhone) {
      updateData.phone = normalizedPhone;
    } else if ("phone" in parsed.data) {
      updateData.$unset = { phone: 1 };
    }

    const existingPhoneOwner = normalizedPhone
      ? await User.findOne({
          phone: normalizedPhone,
          _id: { $ne: session.user.id },
        })
      : null;

    if (existingPhoneOwner) {
      return NextResponse.json(
        { success: false, message: "Phone number is already in use" },
        { status: 409 },
      );
    }

    const user = await User.findByIdAndUpdate(session.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("name email phone avatar bio status twoFactorEnabled");

    if (shouldUploadAvatar && currentUser.avatarPublicId) {
      await deleteChatMedia(currentUser.avatarPublicId);
    }

    if (!nextAvatarInput && currentUser.avatarPublicId) {
      await deleteChatMedia(currentUser.avatarPublicId);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated",
      profile: user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
