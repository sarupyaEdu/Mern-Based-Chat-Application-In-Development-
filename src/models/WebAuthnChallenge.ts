import mongoose, { Model, Schema } from "mongoose";

interface IWebAuthnChallenge {
  challenge: string;
  type: "registration" | "authentication";
  userId?: mongoose.Types.ObjectId | null;
  rememberMe?: boolean;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const WebAuthnChallengeSchema = new Schema<IWebAuthnChallenge>(
  {
    challenge: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["registration", "authentication"],
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    rememberMe: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const existingWebAuthnChallengeModel =
  mongoose.models.WebAuthnChallenge as Model<IWebAuthnChallenge> | undefined;

if (
  existingWebAuthnChallengeModel &&
  (!existingWebAuthnChallengeModel.schema.path("challenge") ||
    !existingWebAuthnChallengeModel.schema.path("rememberMe"))
) {
  delete mongoose.models.WebAuthnChallenge;
}

const WebAuthnChallenge: Model<IWebAuthnChallenge> =
  (mongoose.models.WebAuthnChallenge as Model<IWebAuthnChallenge>) ||
  mongoose.model<IWebAuthnChallenge>(
    "WebAuthnChallenge",
    WebAuthnChallengeSchema,
  );

export default WebAuthnChallenge;
