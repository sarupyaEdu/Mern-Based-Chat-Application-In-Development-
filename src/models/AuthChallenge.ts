import mongoose, { Model, Schema } from "mongoose";

interface IAuthChallenge {
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  purpose: "login-2fa";
  attempts: number;
  rememberMe?: boolean;
  emailOtpHash?: string;
  emailOtpExpiresAt?: Date | null;
  emailOtpSentAt?: Date | null;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuthChallengeSchema = new Schema<IAuthChallenge>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["login-2fa"],
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    rememberMe: {
      type: Boolean,
      default: false,
    },
    emailOtpHash: {
      type: String,
      default: "",
      trim: true,
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },
    emailOtpSentAt: {
      type: Date,
      default: null,
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

const existingAuthChallengeModel =
  mongoose.models.AuthChallenge as Model<IAuthChallenge> | undefined;

if (
  existingAuthChallengeModel &&
  (!existingAuthChallengeModel.schema.path("rememberMe") ||
    !existingAuthChallengeModel.schema.path("emailOtpHash") ||
    !existingAuthChallengeModel.schema.path("emailOtpExpiresAt") ||
    !existingAuthChallengeModel.schema.path("emailOtpSentAt"))
) {
  delete mongoose.models.AuthChallenge;
}

const AuthChallenge: Model<IAuthChallenge> =
  (mongoose.models.AuthChallenge as Model<IAuthChallenge>) ||
  mongoose.model<IAuthChallenge>("AuthChallenge", AuthChallengeSchema);

export default AuthChallenge;
