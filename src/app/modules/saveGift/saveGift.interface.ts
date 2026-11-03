import { Model, Types } from 'mongoose';

export interface TSaveGift {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId;
  saveGiftItem: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type SaveGiftModel = Model<TSaveGift>;
