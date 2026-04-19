import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { deleteChatMedia } from "@/lib/chat-media";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import Message from "@/models/Message";

function buildParticipantKey(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

function getParticipantId(
  participant:
    | string
    | mongoose.Types.ObjectId
    | { _id?: string | mongoose.Types.ObjectId | null }
    | null
    | undefined,
) {
  if (!participant) return null;
  if (typeof participant === "string") return participant;
  if (participant instanceof mongoose.Types.ObjectId) {
    return participant.toString();
  }
  if (participant._id instanceof mongoose.Types.ObjectId) {
    return participant._id.toString();
  }
  if (typeof participant._id === "string") {
    return participant._id;
  }
  return null;
}

function hasAllParticipantsDeleted(
  participants: Array<mongoose.Types.ObjectId | string>,
  deletedForUsers: Array<mongoose.Types.ObjectId | string> = [],
) {
  return participants.every((participantId) =>
    deletedForUsers.some(
      (deletedUserId) => deletedUserId.toString() === participantId.toString(),
    ),
  );
}

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

    const conversations = await Conversation.find({
      participants: session.user.id,
      deletedForUsers: { $ne: session.user.id },
    })
      .populate("participants", "name email phone avatar isOnline lastSeen")
      .populate("lastMessage", "text image createdAt")
      .populate({
        path: "pinnedMessage",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      })
      .sort({ updatedAt: -1 });

    await Promise.all(
      conversations.map(async (conversation) => {
        if (
          !conversation.participantKey &&
          Array.isArray(conversation.participants) &&
          conversation.participants.length === 2
        ) {
          const participantIds = conversation.participants
            .map((participant) => getParticipantId(participant))
            .filter((value): value is string => Boolean(value));

          if (participantIds.length === 2) {
            conversation.participantKey = buildParticipantKey(
              participantIds[0],
              participantIds[1],
            );
            await conversation.save();
          }
        }
      }),
    );

    const userId = session.user.id;

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: userId }, // not sent by me
          seenBy: { $ne: userId }, // not seen by me
        });

        return {
          ...conv.toObject(),
          unreadCount,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    console.error("GET /api/conversations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch conversations",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const body = await req.json();
    const receiverId = body?.receiverId as string;

    if (!receiverId) {
      return NextResponse.json(
        { success: false, message: "receiverId is required" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return NextResponse.json(
        { success: false, message: "Invalid receiverId" },
        { status: 400 },
      );
    }

    if (receiverId === session.user.id) {
      return NextResponse.json(
        { success: false, message: "You cannot chat with yourself" },
        { status: 400 },
      );
    }

    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return NextResponse.json(
        { success: false, message: "Receiver not found" },
        { status: 404 },
      );
    }

    const participantKey = buildParticipantKey(session.user.id, receiverId);

    let createdNewConversation = false;

    let conversation = await Conversation.findOne({
      participantKey,
    })
      .populate("participants", "name email phone avatar isOnline lastSeen")
      .populate("lastMessage", "text image createdAt")
      .populate({
        path: "pinnedMessage",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      });

    if (!conversation) {
      conversation = await Conversation.findOne({
        participants: { $all: [session.user.id, receiverId] },
      })
        .populate("participants", "name email phone avatar isOnline lastSeen")
        .populate("lastMessage", "text image createdAt")
        .populate({
          path: "pinnedMessage",
          populate: {
            path: "sender",
            select: "name email avatar",
          },
        });
    }

    if (conversation && conversation.participantKey !== participantKey) {
      conversation.participantKey = participantKey;
      await conversation.save();
    }

    if (
      conversation &&
      conversation.deletedForUsers?.some(
        (userId) => userId.toString() === session.user.id,
      )
    ) {
      conversation.deletedForUsers = conversation.deletedForUsers.filter(
        (userId) => userId.toString() !== session.user.id,
      );
      await conversation.save();
    }

    if (!conversation) {
      createdNewConversation = true;
      conversation = await Conversation.create({
        participants: [session.user.id, receiverId],
        participantKey,
      });

      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "name email phone avatar isOnline lastSeen",
      );

      conversation = await conversation?.populate(
        "lastMessage",
        "text image createdAt",
      );

      conversation = await conversation?.populate({
        path: "pinnedMessage",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Conversation ready",
        conversation,
      },
      { status: createdNewConversation ? 201 : 200 },
    );
  } catch (error) {
    console.error("POST /api/conversations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create conversation",
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

    await connectDB();

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json(
        { success: false, message: "Valid conversationId is required" },
        { status: 400 },
      );
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversation not found" },
        { status: 404 },
      );
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === session.user.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      );
    }

    if (
      !conversation.deletedForUsers?.some(
        (userId) => userId.toString() === session.user.id,
      )
    ) {
      conversation.deletedForUsers = [
        ...(conversation.deletedForUsers || []),
        new mongoose.Types.ObjectId(session.user.id),
      ];
      await conversation.save();
    }

    if (
      hasAllParticipantsDeleted(
        conversation.participants,
        conversation.deletedForUsers || [],
      )
    ) {
      const messagesWithMedia = await Message.find({
        conversationId: conversation._id,
        imagePublicId: { $ne: "" },
      }).select("imagePublicId");

      await Promise.all(
        messagesWithMedia.map((message) => deleteChatMedia(message.imagePublicId)),
      );

      await Message.deleteMany({ conversationId: conversation._id });
      await Conversation.findByIdAndDelete(conversation._id);

      return NextResponse.json({
        success: true,
        message: "Chat deleted for everyone",
        permanentlyDeleted: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Chat deleted for you",
    });
  } catch (error) {
    console.error("DELETE /api/conversations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete chat",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
