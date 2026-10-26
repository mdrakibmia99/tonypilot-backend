import { Types } from 'mongoose';

export interface IMessageAttachment {
  url: string;
  fileType: string;
  name?: string;
  size?: number;
}

export interface IMessage {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  attachments: IMessageAttachment[];
  isDeletedForEveryone: boolean;
  deletedByUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISendMessagePayload {
  chatId: string;
  content: string;
  attachments?: IMessageAttachment[];
}

export interface IMessageQueryOptions {
  cursor?: string;
  limit?: number;
}

export interface IMessageSenderSummary {
  _id: string;
  fullName: string;
  profileImage?: string;
  email: string;
}

export interface ITransformedMessage {
  _id: string;
  chat: string;
  sender: IMessageSenderSummary;
  content: string;
  attachments: IMessageAttachment[];
  isDeletedForEveryone: boolean;
  isMyMessage: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaginatedMessagesResponse {
  messages: ITransformedMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}
