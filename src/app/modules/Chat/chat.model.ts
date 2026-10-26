import { Schema, model } from 'mongoose';
import { IChat, IUserChatVisibility } from './chat.interface';

const userChatVisibilitySchema = new Schema<IUserChatVisibility>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clearedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>(
  {
    isGroupChat: {
      type: Boolean,
      default: false,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    userChatVisibility: {
      type: [userChatVisibilitySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  }
);

// High-performance compound indexes for messenger queries
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ isGroupChat: 1, participants: 1 });
chatSchema.index({ 'userChatVisibility.user': 1 });

export const Chat = model<IChat>('Chat', chatSchema);
