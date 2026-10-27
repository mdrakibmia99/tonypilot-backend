import { Types, Model } from 'mongoose';
import {
  TCommentType,
  TFlagTargetType,
  TFlagReasonCode,
  TFlagResolutionStatus,
} from './liveComment.constants';

export interface TLiveComment {
  _id?: Types.ObjectId | string;
  stream: Types.ObjectId; // ref -> LiveStream
  user: Types.ObjectId; // ref -> User
  message: string;
  commentType: TCommentType;
  isPinned: boolean;
  pinnedAt?: Date | null;
  pinnedBy?: Types.ObjectId | null; // ref -> User (host or admin)

  isDeletedByMod: boolean;
  deletedByModAt?: Date | null;
  deletedByModUser?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveCommentModel extends Model<TLiveComment> {}

export interface TModerationFlag {
  _id?: Types.ObjectId | string;
  reporter: Types.ObjectId; // ref -> User (who reported)
  targetType: TFlagTargetType;
  targetId: Types.ObjectId;
  targetRef: string; // Model name for populate

  reasonCode: TFlagReasonCode;
  reasonText?: string;

  resolutionStatus: TFlagResolutionStatus;
  resolvedBy?: Types.ObjectId | null; // ref -> User (admin)
  resolvedAt?: Date | null;
  resolutionNotes?: string;
  actionTaken?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ModerationFlagModel extends Model<TModerationFlag> {}
