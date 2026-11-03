import { Schema, model } from 'mongoose';
import { TSaveGift, SaveGiftModel } from './saveGift.interface';

const saveGiftSchema = new Schema<TSaveGift>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    saveGiftItem: [
      {
        type: Schema.Types.ObjectId,
        ref: 'GiftItem',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Index on userId for fast lookups
saveGiftSchema.index({ userId: 1 });

export const SaveGift = model<TSaveGift, SaveGiftModel>(
  'SaveGift',
  saveGiftSchema,
);
