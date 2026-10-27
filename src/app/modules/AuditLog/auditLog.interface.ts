import { Model, Types } from 'mongoose';

export type AuditAction =
  | 'GIFT_AWARDED_LIVE'
  | 'STREAM_TERMINATED_BY_ADMIN'
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  | 'USER_SUSPENDED'
  | 'USER_WARNED'
  | 'HOST_MUTED'
  | 'CLAIM_REMOVED'
  | 'CLAIM_APPROVED'
  | 'CLAIM_FLAGGED'
  | 'GIFT_APPROVED'
  | 'GIFT_REJECTED'
  | 'GIFT_FLAGGED'
  | 'COMMENT_DELETED'
  | 'WINNER_REASSIGNED'
  | 'SUBSCRIPTION_PLAN_CREATED'
  | 'SUBSCRIPTION_PLAN_UPDATED'
  | 'SUBSCRIPTION_PLAN_DEACTIVATED'
  | 'MODERATION_FLAG_RESOLVED'
  | 'SYSTEM_SETTING_CHANGED';

export interface TAdminAuditLog {
  _id?: Types.ObjectId | string;
  action: AuditAction;
  performedBy: Types.ObjectId;
  performedByRole: string; // 'user' | 'host' | 'admin' | 'super_admin'

  targetUser?: Types.ObjectId | null;
  targetStream?: Types.ObjectId | null;
  targetGiftItem?: Types.ObjectId | null;
  targetClaim?: Types.ObjectId | null;
  targetComment?: Types.ObjectId | null;
  targetFlag?: Types.ObjectId | null;

  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;

  createdAt?: Date;
}

export interface AdminAuditLogModel extends Model<TAdminAuditLog> {}

export interface TSystemAnalytics {
  _id?: Types.ObjectId | string;
  date: Date;

  totalUsers: number;
  newUsersToday: number;
  activeUsersToday: number;
  blockedUsers: number;

  totalGiftsPublished: number;
  giftsPublishedToday: number;
  giftsClaimedToday: number;
  giftsDeliveredToday: number;

  totalStreamsHosted: number;
  streamsHostedToday: number;
  peakConcurrentViewersToday: number;
  totalViewMinutesToday: number;

  totalClaimsSubmitted: number;
  claimsSubmittedToday: number;
  claimsAwardedToday: number;

  totalRevenueCents: number;
  revenueTodayCents: number;
  activeSubscriptions: number;
  newSubscriptionsToday: number;
  churnsToday: number;

  openFlags: number;
  flagsResolvedToday: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemAnalyticsModel extends Model<TSystemAnalytics> {}
