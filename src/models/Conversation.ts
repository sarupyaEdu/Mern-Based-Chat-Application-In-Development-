import mongoose, { Model, Schema } from "mongoose";
import { IConversation } from "@/types";

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    participantKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    pinnedMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    deletedForUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  },
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ participantKey: 1 }, { unique: true, sparse: true });
ConversationSchema.path("deletedForUsers").default(() => []);

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
