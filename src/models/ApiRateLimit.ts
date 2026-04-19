import mongoose, { Model, Schema } from "mongoose";

interface IApiRateLimit {
  key: string;
  count: number;
  windowStart: Date;
  blockedUntil?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ApiRateLimitSchema = new Schema<IApiRateLimit>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const ApiRateLimit: Model<IApiRateLimit> =
  (mongoose.models.ApiRateLimit as Model<IApiRateLimit>) ||
  mongoose.model<IApiRateLimit>("ApiRateLimit", ApiRateLimitSchema);

export default ApiRateLimit;
