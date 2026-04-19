import mongoose, { Model, Schema } from "mongoose";

interface IPasswordResetOtp {
  userId: mongoose.Types.ObjectId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const PasswordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

PasswordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetOtp: Model<IPasswordResetOtp> =
  (mongoose.models.PasswordResetOtp as Model<IPasswordResetOtp>) ||
  mongoose.model<IPasswordResetOtp>(
    "PasswordResetOtp",
    PasswordResetOtpSchema,
  );

export default PasswordResetOtp;
