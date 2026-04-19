import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { deleteChatMedia, uploadChatMedia } from "@/lib/chat-media";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import "@/models/User";

function hasAllParticipants(
  participantIds: Array<mongoose.Types.ObjectId | string>,
  deletedForUsers: Array<mongoose.Types.ObjectId | string> = [],
) {
  return participantIds.every((participantId) =>
    deletedForUsers.some(
      (deletedUserId) => deletedUserId.toString() === participantId.toString(),
    ),
  );
}

async function syncConversationAfterMessageRemoval(
  conversation: mongoose.Document & {
    _id: mongoose.Types.ObjectId;
    lastMessage?: mongoose.Types.ObjectId | null;
    pinnedMessage?: mongoose.Types.ObjectId | null;
  },
  removedMessageId: string,
) {
  let shouldSaveConversation = false;

  if (conversation.pinnedMessage?.toString() === removedMessageId) {
    conversation.pinnedMessage = null;
    shouldSaveConversation = true;
  }

  if (conversation.lastMessage?.toString() === removedMessageId) {
    const latestRemainingMessage = await Message.findOne({
      conversationId: conversation._id,
      _id: { $ne: removedMessageId },
    }).sort({ createdAt: -1 });

    conversation.lastMessage = latestRemainingMessage?._id || null;
    shouldSaveConversation = true;
  }

  if (shouldSaveConversation) {
    await conversation.save();
  }
}

export async function GET(req: Request) {
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

    if (!conversationId) {
      return NextResponse.json(
        { success: false, message: "conversationId is required" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json(
        { success: false, message: "Invalid conversationId" },
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
      (p) => p.toString() === session.user.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      );
    }

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: session.user.id },
        deliveredTo: { $ne: session.user.id },
      },
      {
        $addToSet: { deliveredTo: session.user.id },
      },
    );

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: session.user.id },
        seenBy: { $ne: session.user.id },
      },
      {
        $addToSet: { seenBy: session.user.id },
      },
    );

    const messages = await Message.find({ conversationId })
      .where("deletedForUsers")
      .ne(session.user.id)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      })
      .sort({ createdAt: 1 });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("GET /api/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch messages",
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
    const { conversationId, text, image, replyTo } = body;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, message: "conversationId is required" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json(
        { success: false, message: "Invalid conversationId" },
        { status: 400 },
      );
    }

    if ((!text || !text.trim()) && !image) {
      return NextResponse.json(
        { success: false, message: "Message text or image is required" },
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
      (p) => p.toString() === session.user.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      );
    }

    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return NextResponse.json(
          { success: false, message: "Invalid replyTo" },
          { status: 400 },
        );
      }

      const replyMessage = await Message.findOne({
        _id: replyTo,
        conversationId,
      });

      if (!replyMessage) {
        return NextResponse.json(
          { success: false, message: "Reply target not found" },
          { status: 404 },
        );
      }
    }

    const uploadedMedia = image ? await uploadChatMedia(image) : null;

    const message = await Message.create({
      conversationId,
      sender: session.user.id,
      text: text?.trim() || "",
      image: uploadedMedia?.image || "",
      imagePublicId: uploadedMedia?.imagePublicId || "",
      replyTo: replyTo || null,
      deliveredTo: [session.user.id],
      seenBy: [session.user.id],
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      $set: { deletedForUsers: [] },
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      });

    return NextResponse.json(
      {
        success: true,
        message: "Message sent",
        data: populatedMessage,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send message",
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

    await connectDB();

    const body = await req.json();
    const { messageId, action, text } = body ?? {};

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json(
        { success: false, message: "Valid messageId is required" },
        { status: 400 },
      );
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Message not found" },
        { status: 404 },
      );
    }

    const conversation = await Conversation.findById(message.conversationId);

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

    if (action === "toggle-star") {
      message.starred = !message.starred;
      await message.save();
    } else if (action === "pin") {
      conversation.pinnedMessage =
        conversation.pinnedMessage?.toString() === messageId ? null : message._id;
      await conversation.save();
    } else if (action === "edit") {
      if (message.sender.toString() !== session.user.id) {
        return NextResponse.json(
          { success: false, message: "Only your messages can be edited" },
          { status: 403 },
        );
      }

      const nextText = typeof text === "string" ? text.trim() : "";

      if (!nextText) {
        return NextResponse.json(
          { success: false, message: "Message text is required" },
          { status: 400 },
        );
      }

      message.text = nextText;
      message.edited = true;
      await message.save();

      if (conversation.lastMessage?.toString() === messageId) {
        conversation.markModified("lastMessage");
        await conversation.save();
      }
    } else {
      return NextResponse.json(
        { success: false, message: "Unsupported action" },
        { status: 400 },
      );
    }

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      });

    return NextResponse.json({
      success: true,
      message: "Message updated",
      data: populatedMessage,
      pinnedMessageId: conversation.pinnedMessage?.toString() || null,
    });
  } catch (error) {
    console.error("PATCH /api/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update message",
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
    const messageId = searchParams.get("messageId");
    const deleteFor = searchParams.get("deleteFor") || "everyone";

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json(
        { success: false, message: "Valid messageId is required" },
        { status: 400 },
      );
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Message not found" },
        { status: 404 },
      );
    }

    if (message.sender.toString() !== session.user.id && deleteFor === "everyone") {
      return NextResponse.json(
        { success: false, message: "Only your messages can be deleted" },
        { status: 403 },
      );
    }

    const conversation = await Conversation.findById(message.conversationId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversation not found" },
        { status: 404 },
      );
    }

    if (deleteFor === "me") {
      if (
        !message.deletedForUsers?.some(
          (userId) => userId.toString() === session.user.id,
        )
      ) {
        message.deletedForUsers = [
          ...(message.deletedForUsers || []),
          new mongoose.Types.ObjectId(session.user.id),
        ];
        await message.save();
      }

      if (
        hasAllParticipants(conversation.participants, message.deletedForUsers || [])
      ) {
        await deleteChatMedia(message.imagePublicId);
        await syncConversationAfterMessageRemoval(conversation, messageId);
        await Message.findByIdAndDelete(messageId);
      }
    } else {
      await deleteChatMedia(message.imagePublicId);
      message.text = "";
      message.image = "";
      message.imagePublicId = "";
      message.deletedForEveryone = true;
      message.edited = false;
      await message.save();

      if (conversation.pinnedMessage?.toString() === messageId) {
        conversation.pinnedMessage = null;
        await conversation.save();
      }
    }

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name email avatar",
        },
      });

    return NextResponse.json({
      success: true,
      message: deleteFor === "me" ? "Message deleted for you" : "Message deleted",
      data: populatedMessage,
      pinnedMessageId: conversation.pinnedMessage?.toString() || null,
      deleteFor,
    });
  } catch (error) {
    console.error("DELETE /api/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete message",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
