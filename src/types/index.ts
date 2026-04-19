import { Types } from "mongoose";

export type MongoId = Types.ObjectId | string;

export interface IUserSafe {
  _id: MongoId;
  name: string;
  savedName?: string;
  accountName?: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  isOnline?: boolean;
  lastSeen?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IContact {
  _id?: MongoId;
  owner: MongoId;
  contactUser: MongoId;
  savedName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversation {
  _id?: MongoId;
  participants: MongoId[];
  participantKey?: string;
  lastMessage?: MongoId | null;
  pinnedMessage?: MongoId | null;
  deletedForUsers?: MongoId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMessage {
  _id?: MongoId;
  conversationId: MongoId;
  sender: MongoId;
  text?: string;
  image?: string;
  imagePublicId?: string;
  deliveredTo?: MongoId[];
  seenBy?: MongoId[];
  deletedForUsers?: MongoId[];
  replyTo?: MongoId | null;
  starred?: boolean;
  edited?: boolean;
  deletedForEveryone?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
