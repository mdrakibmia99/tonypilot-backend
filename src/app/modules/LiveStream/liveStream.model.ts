import { Schema, model, Query } from 'mongoose';
import { TLiveStream, LiveStreamModel } from './liveStream.interface';
import { LIVE_STREAM_STATUS_ENUM, LIVE_STREAM_STATUS } from './liveStream.constants';

const liveStreamSchema = new Schema<TLiveStream>(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      trim: true,
    },
    channelName: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      maxlength: 100,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host is required'],
    },
    giftItem: {
      type: Schema.Types.ObjectId,
      ref: 'GiftItem',
      required: [true, 'Gift item is required'],
    },
    status: {
      type: String,
      enum: LIVE_STREAM_STATUS_ENUM,
      required: true,
      default: LIVE_STREAM_STATUS.SCHEDULED,
    },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    timerDurationSeconds: {
      type: Number,
      required: true,
      default: 900,
      min: 60,
      max: 10800, // 3 hours max
    },
    actualDurationSeconds: { type: Number, default: 0 },

    peakViewers: { type: Number, default: 0 },
    totalUniqueViewers: { type: Number, default: 0 },
    totalReach: { type: Number, default: 0 },

    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winningClaim: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStoryClaim',
      default: null,
    },
    awardedAt: { type: Date, default: null },

    pinnedClaim: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStoryClaim',
      default: null,
    },
    pinnedGiftCard: { type: Boolean, default: true },

    totalClaimsReceived: { type: Number, default: 0 },
    totalClaimsPinned: { type: Number, default: 0 },

    terminatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    terminationReason: { type: String, default: '' },

    wrapUpSummary: {
      airTimeFormatted: { type: String, default: '' },
      totalLiveClaims: { type: Number, default: 0 },
      peakViewerCount: { type: Number, default: 0 },
      totalReachCount: { type: Number, default: 0 },
      winnerName: { type: String, default: '' },
      giftTitle: { type: String, default: '' },
    },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// ===== INDEXES =====
liveStreamSchema.index({ status: 1, createdAt: -1 });
liveStreamSchema.index({ host: 1, status: 1 });
liveStreamSchema.index({ giftItem: 1 });
liveStreamSchema.index({ startedAt: -1 });
liveStreamSchema.index({ status: 1, startedAt: -1 });

// Soft-delete query filter
liveStreamSchema.pre<Query<any, TLiveStream>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const LiveStream = model<TLiveStream, LiveStreamModel>(
  'LiveStream',
  liveStreamSchema,
);
