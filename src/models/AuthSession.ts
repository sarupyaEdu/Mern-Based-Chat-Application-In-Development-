import mongoose, { Model, Schema } from "mongoose";

interface IAuthSession {
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>(
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

const AuthSession: Model<IAuthSession> =
  (mongoose.models.AuthSession as Model<IAuthSession>) ||
  mongoose.model<IAuthSession>("AuthSession", AuthSessionSchema);

export default AuthSession;
