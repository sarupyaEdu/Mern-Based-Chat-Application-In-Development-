import mongoose, { Model, Schema } from "mongoose";

interface ITwoFactorDisableOtp {
  userId: mongoose.Types.ObjectId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const TwoFactorDisableOtpSchema = new Schema<ITwoFactorDisableOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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

const existingTwoFactorDisableOtpModel =
  mongoose.models.TwoFactorDisableOtp as Model<ITwoFactorDisableOtp> | undefined;

if (
  existingTwoFactorDisableOtpModel &&
  !existingTwoFactorDisableOtpModel.schema.path("attempts")
) {
  delete mongoose.models.TwoFactorDisableOtp;
}

const TwoFactorDisableOtp: Model<ITwoFactorDisableOtp> =
  (mongoose.models.TwoFactorDisableOtp as Model<ITwoFactorDisableOtp>) ||
  mongoose.model<ITwoFactorDisableOtp>(
    "TwoFactorDisableOtp",
    TwoFactorDisableOtpSchema,
  );

export default TwoFactorDisableOtp;
