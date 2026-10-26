import { Schema, model } from 'mongoose';
import { IMessage, IMessageAttachment } from './message.interface';

const attachmentSchema = new Schema<IMessageAttachment>(
  {
    url: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    size: {
      type: Number,
    },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'Chat ID is required for a message'],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedByUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  }
);

// High-performance compound indexes for cursor-based pagination & fast filtering
messageSchema.index({ chat: 1, _id: -1 });
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ deletedByUsers: 1 });

export const Message = model<IMessage>('Message', messageSchema);
