import mongoose, { Model, Schema } from "mongoose";
import { IContact } from "@/types";

const ContactSchema = new Schema<IContact>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contactUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    savedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  {
    timestamps: true,
  },
);

ContactSchema.index({ owner: 1, contactUser: 1 }, { unique: true });

const existingContactModel = mongoose.models.Contact as Model<IContact> | undefined;

if (existingContactModel && !existingContactModel.schema.path("savedName")) {
  delete mongoose.models.Contact;
}

const Contact: Model<IContact> =
  (mongoose.models.Contact as Model<IContact>) ||
  mongoose.model<IContact>("Contact", ContactSchema);

export default Contact;
