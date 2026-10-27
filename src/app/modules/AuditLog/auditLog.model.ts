import { Schema, model } from 'mongoose';
import {
  TAdminAuditLog,
  AdminAuditLogModel,
  TSystemAnalytics,
  SystemAnalyticsModel,
} from './auditLog.interface';

const adminAuditLogSchema = new Schema<TAdminAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'GIFT_AWARDED_LIVE',
        'STREAM_TERMINATED_BY_ADMIN',
        'USER_BANNED',
        'USER_UNBANNED',
        'USER_SUSPENDED',
        'USER_WARNED',
        'HOST_MUTED',
        'CLAIM_REMOVED',
        'CLAIM_APPROVED',
        'CLAIM_FLAGGED',
        'GIFT_APPROVED',
        'GIFT_REJECTED',
        'GIFT_FLAGGED',
        'COMMENT_DELETED',
        'WINNER_REASSIGNED',
        'SUBSCRIPTION_PLAN_CREATED',
        'SUBSCRIPTION_PLAN_UPDATED',
        'SUBSCRIPTION_PLAN_DEACTIVATED',
        'MODERATION_FLAG_RESOLVED',
        'SYSTEM_SETTING_CHANGED',
      ],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
      enum: ['user', 'host', 'admin', 'super_admin'],
    },

    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetStream: { type: Schema.Types.ObjectId, ref: 'LiveStream', default: null },
    targetGiftItem: { type: Schema.Types.ObjectId, ref: 'GiftItem', default: null },
    targetClaim: { type: Schema.Types.ObjectId, ref: 'LiveStoryClaim', default: null },
    targetComment: { type: Schema.Types.ObjectId, ref: 'LiveComment', default: null },
    targetFlag: { type: Schema.Types.ObjectId, ref: 'ModerationFlag', default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetUser: 1 });
adminAuditLogSchema.index({ targetStream: 1 });
adminAuditLogSchema.index({ targetClaim: 1 });
adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = model<TAdminAuditLog, AdminAuditLogModel>(
  'AdminAuditLog',
  adminAuditLogSchema,
);

const systemAnalyticsSchema = new Schema<TSystemAnalytics>(
  {
    date: { type: Date, required: true, unique: true },

    totalUsers: { type: Number, default: 0 },
    newUsersToday: { type: Number, default: 0 },
    activeUsersToday: { type: Number, default: 0 },
    blockedUsers: { type: Number, default: 0 },

    totalGiftsPublished: { type: Number, default: 0 },
    giftsPublishedToday: { type: Number, default: 0 },
    giftsClaimedToday: { type: Number, default: 0 },
    giftsDeliveredToday: { type: Number, default: 0 },

    totalStreamsHosted: { type: Number, default: 0 },
    streamsHostedToday: { type: Number, default: 0 },
    peakConcurrentViewersToday: { type: Number, default: 0 },
    totalViewMinutesToday: { type: Number, default: 0 },

    totalClaimsSubmitted: { type: Number, default: 0 },
    claimsSubmittedToday: { type: Number, default: 0 },
    claimsAwardedToday: { type: Number, default: 0 },

    totalRevenueCents: { type: Number, default: 0 },
    revenueTodayCents: { type: Number, default: 0 },
    activeSubscriptions: { type: Number, default: 0 },
    newSubscriptionsToday: { type: Number, default: 0 },
    churnsToday: { type: Number, default: 0 },

    openFlags: { type: Number, default: 0 },
    flagsResolvedToday: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

systemAnalyticsSchema.index({ date: -1 });

export const SystemAnalytics = model<TSystemAnalytics, SystemAnalyticsModel>(
  'SystemAnalytics',
  systemAnalyticsSchema,
);
