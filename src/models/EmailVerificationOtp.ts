import mongoose, { Model, Schema } from "mongoose";

interface IEmailVerificationOtp {
  userId: mongoose.Types.ObjectId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const EmailVerificationOtpSchema = new Schema<IEmailVerificationOtp>(
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

EmailVerificationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailVerificationOtp: Model<IEmailVerificationOtp> =
  (mongoose.models.EmailVerificationOtp as Model<IEmailVerificationOtp>) ||
  mongoose.model<IEmailVerificationOtp>(
    "EmailVerificationOtp",
    EmailVerificationOtpSchema,
  );

export default EmailVerificationOtp;
