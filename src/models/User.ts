import mongoose, { Model, Schema } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  password: string;
  avatar?: string;
  avatarPublicId?: string;
  bio?: string;
  status?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorTempSecret?: string;
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
  isOnline?: boolean;
  lastSeen?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    avatarPublicId: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "Available",
      trim: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      default: "",
      trim: true,
    },
    twoFactorTempSecret: {
      type: String,
      default: "",
      trim: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const existingUserModel = mongoose.models.User as Model<IUser> | undefined;

if (
  existingUserModel &&
  (!existingUserModel.schema.path("avatarPublicId") ||
    !existingUserModel.schema.path("emailVerified") ||
    !existingUserModel.schema.path("failedLoginAttempts") ||
    !existingUserModel.schema.path("twoFactorEnabled"))
) {
  delete mongoose.models.User;
}

const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
