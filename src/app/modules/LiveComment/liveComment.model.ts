import { Schema, model } from 'mongoose';
import {
  TLiveComment,
  LiveCommentModel,
  TModerationFlag,
  ModerationFlagModel,
} from './liveComment.interface';
import {
  COMMENT_TYPE_ENUM,
  COMMENT_TYPE,
  FLAG_TARGET_TYPE_ENUM,
  FLAG_REASON_CODE_ENUM,
  FLAG_RESOLUTION_STATUS_ENUM,
  FLAG_RESOLUTION_STATUS,
} from './liveComment.constants';

// ==========================================
// LIVE COMMENT SCHEMA
// ==========================================
const liveCommentSchema = new Schema<TLiveComment>(
  {
    stream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: [true, 'Stream ID is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Comment message is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    commentType: {
      type: String,
      enum: COMMENT_TYPE_ENUM,
      default: COMMENT_TYPE.TEXT,
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isDeletedByMod: { type: Boolean, default: false },
    deletedByModAt: { type: Date, default: null },
    deletedByModUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  },
);

liveCommentSchema.index({ stream: 1, createdAt: -1 });
liveCommentSchema.index({ stream: 1, isPinned: 1 });
// Ephemeral TTL Index: Auto-delete comments 7 days after creation
liveCommentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const LiveComment = model<TLiveComment, LiveCommentModel>(
  'LiveComment',
  liveCommentSchema,
);

// ==========================================
// MODERATION FLAG SCHEMA
// ==========================================
const moderationFlagSchema = new Schema<TModerationFlag>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
      index: true,
    },
    targetType: {
      type: String,
      enum: FLAG_TARGET_TYPE_ENUM,
      required: [true, 'Target type is required'],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Target ID is required'],
    },
    targetRef: {
      type: String,
      required: [true, 'Target reference model is required'],
    },

    reasonCode: {
      type: String,
      enum: FLAG_REASON_CODE_ENUM,
      required: [true, 'Reason code is required'],
    },
    reasonText: { type: String, default: '', maxlength: 1000 },

    resolutionStatus: {
      type: String,
      enum: FLAG_RESOLUTION_STATUS_ENUM,
      default: FLAG_RESOLUTION_STATUS.OPEN,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: '' },
    actionTaken: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

moderationFlagSchema.index({ targetType: 1, targetId: 1 });
moderationFlagSchema.index({ resolutionStatus: 1, createdAt: -1 });
// Compound Unique Index: Prevent duplicate reports by same user on same target
moderationFlagSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  { unique: true },
);

export const ModerationFlag = model<TModerationFlag, ModerationFlagModel>(
  'ModerationFlag',
  moderationFlagSchema,
);
