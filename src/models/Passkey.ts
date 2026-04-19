import mongoose, { Model, Schema } from "mongoose";

interface IPasskey {
  userId: mongoose.Types.ObjectId;
  credentialID: string;
  publicKey: Buffer;
  counter: number;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const PasskeySchema = new Schema<IPasskey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    credentialID: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    publicKey: {
      type: Buffer,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
    deviceType: {
      type: String,
      default: "",
      trim: true,
    },
    backedUp: {
      type: Boolean,
      default: false,
    },
    transports: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const existingPasskeyModel = mongoose.models.Passkey as Model<IPasskey> | undefined;

if (
  existingPasskeyModel &&
  (!existingPasskeyModel.schema.path("credentialID") ||
    !existingPasskeyModel.schema.path("publicKey"))
) {
  delete mongoose.models.Passkey;
}

const Passkey: Model<IPasskey> =
  (mongoose.models.Passkey as Model<IPasskey>) ||
  mongoose.model<IPasskey>("Passkey", PasskeySchema);

export default Passkey;
