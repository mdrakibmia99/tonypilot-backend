import { Schema, model, Query } from 'mongoose';
import { TLiveStoryClaim, LiveStoryClaimModel } from './storyClaim.interface';

const liveStoryClaimSchema = new Schema<TLiveStoryClaim>(
  {
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant is required'],
      index: true,
    },
    stream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: [true, 'Stream is required'],
      index: true,
    },
    giftItem: {
      type: Schema.Types.ObjectId,
      ref: 'GiftItem',
      required: [true, 'Gift item is required'],
    },

    storyStatement: {
      type: String,
      required: [true, 'Story statement is required'],
      trim: true,
      maxlength: [3000, 'Story cannot exceed 3000 characters'],
      minlength: [20, 'Story must be at least 20 characters'],
    },
    storyMediaUrl: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'pinned', 'awarded', 'rejected', 'withdrawn'],
      default: 'pending',
    },

    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    voterIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    unpinnedAt: { type: Date, default: null },
    awardedAt: { type: Date, default: null },

    adminReviewStatus: {
      type: String,
      enum: ['not_reviewed', 'approved', 'flagged', 'removed'],
      default: 'not_reviewed',
    },
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReviewNotes: { type: String, default: '' },
    adminRemovedAt: { type: Date, default: null },

    pickupConfirmed: { type: Boolean, default: false },
    pickupConfirmedAt: { type: Date, default: null },
    pickupNotes: { type: String, default: '', maxlength: 500 },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// ===== INDEXES =====
liveStoryClaimSchema.index({ stream: 1, status: 1, createdAt: -1 });
liveStoryClaimSchema.index({ applicant: 1, stream: 1 }, { unique: true });
liveStoryClaimSchema.index({ stream: 1, isPinned: 1 });
liveStoryClaimSchema.index({ giftItem: 1, status: 1 });
liveStoryClaimSchema.index({ adminReviewStatus: 1 });

// Soft-delete filter
liveStoryClaimSchema.pre<Query<any, TLiveStoryClaim>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const LiveStoryClaim = model<TLiveStoryClaim, LiveStoryClaimModel>(
  'LiveStoryClaim',
  liveStoryClaimSchema,
);
