import { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { User } from '../user/user.models';
import { USER_ROLE } from '../user/user.constants';
import { LiveStream } from '../LiveStream/liveStream.model';
import {
  LIVE_STREAM_STATUS,
  LIVE_STREAM_REDIS_KEYS,
} from '../LiveStream/liveStream.constants';
import { GiftItem } from '../GiftItem/giftItem.model';
import { LiveStoryClaim } from '../StoryClaim/storyClaim.model';
import {
  STORY_CLAIM_STATUS,
  STORY_CLAIM_REDIS_KEYS,
} from '../StoryClaim/storyClaim.constants';
import { ModerationFlag } from '../LiveComment/liveComment.model';
import {
  PaymentTransaction,
  UserSubscription,
} from '../Subscription/subscription.model';
import { AdminAuditLog } from '../AuditLog/auditLog.model';
import { generateAdminSpectatorToken } from '../LiveStream/zego.utils';
import { LiveStreamService } from '../LiveStream/liveStream.service';
import { RedisService } from '../../redis';
import { getIO } from '../../../socket';
import QueryBuilder from '../../builder/QueryBuilder';
import { IJwtPayload } from '../auth/auth.interface';
import {
  IUserModerationActionPayload,
  IForceTerminateStreamPayload,
  IMuteHostPayload,
  IReviewStoryClaimPayload,
  ITelemetryOverview,
  IRevenueAnalytics,
} from './admin.interface';

const safeEmitToRoom = (room: string, event: string, payload: any) => {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch {
    // Socket server may not be active in test environments
  }
};

// ==========================================
// 1. TELEMETRY OVERVIEW STATS (Admin KPI Dashboard)
// ==========================================
const getTelemetryOverview = async (): Promise<ITelemetryOverview> => {
  const cacheKey = 'admin:dashboard:summary';
  const cached = await RedisService.get<ITelemetryOverview>(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parallel KPI counts
  const [
    totalUsers,
    newUsersToday,
    activeLiveStreams,
    totalGiftsGiven,
    totalClaimsSubmitted,
    openModerationFlags,
    revenueAggregation,
    recentAuditLogs,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: false, createdAt: { $gte: startOfDay } }),
    LiveStream.countDocuments({
      status: LIVE_STREAM_STATUS.LIVE,
      isDeleted: false,
    }),
    GiftItem.countDocuments({
      claimState: { $in: ['claimed', 'pickup_arranged', 'delivered'] },
      isDeleted: false,
    }),
    LiveStoryClaim.countDocuments({ isDeleted: false }),
    ModerationFlag.countDocuments({ resolutionStatus: 'open' }),
    PaymentTransaction.aggregate([
      {
        $match: {
          status: 'succeeded',
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountInCents' },
        },
      },
    ]),
    AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('performedBy', 'fullName email'),
  ]);

  const revenueThisMonthInCents = revenueAggregation[0]?.total || 0;

  const recentActivity = recentAuditLogs.map((log: any) => ({
    action: log.action,
    performedBy: log.performedBy?.fullName || 'System',
    timestamp: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
  }));

  const telemetry: ITelemetryOverview = {
    totalUsers,
    newUsersToday,
    activeLiveStreams,
    totalGiftsGiven,
    totalClaimsSubmitted,
    revenueThisMonthInCents,
    openModerationFlags,
    recentActivity,
  };

  await RedisService.set(cacheKey, telemetry, 300); // 5 min TTL
  return telemetry;
};

// ==========================================
// 2. LIVE STREAM ACTIVE CONTROL ROOM
// ==========================================
const getActiveLiveStreamsControlRoom = async (adminId: string) => {
  const cacheKey = LIVE_STREAM_REDIS_KEYS.ADMIN_ACTIVE_LIST;
  const cached = await RedisService.get(cacheKey);
  if (cached) {
    return cached;
  }

  const activeStreams = await LiveStream.find({
    status: LIVE_STREAM_STATUS.LIVE,
    isDeleted: false,
  })
    .populate('host', 'fullName profileImage neighborhoodLabel email communityTrustScore')
    .populate('giftItem', 'title category condition images estimatedValue')
    .populate('pinnedClaim');

  const enrichedStreams = await Promise.all(
    activeStreams.map(async (st) => {
      const liveViewerCount = await RedisService.sCard(
        LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(st._id.toString()),
      );

      const flagCount = await ModerationFlag.countDocuments({
        targetType: 'live_stream',
        targetId: st._id,
        resolutionStatus: 'open',
      });

      const adminToken = generateAdminSpectatorToken({
        adminId,
        roomId: st.roomId,
      });

      const obj = st.toObject();
      return {
        ...obj,
        currentViewerCount: liveViewerCount || st.peakViewers || 0,
        flagCount,
        adminToken,
      };
    }),
  );

  await RedisService.set(cacheKey, enrichedStreams, LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST_TTL);
  return enrichedStreams;
};

// ==========================================
// 3. REMOTE STREAM FORCE-END (KILLSWITCH)
// ==========================================
const forceTerminateStream = async (
  adminId: string,
  adminRole: string,
  streamId: string,
  payload: IForceTerminateStreamPayload,
) => {
  const stream = await LiveStream.findById(streamId);
  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  // Gracefully end and terminate stream via LiveStreamService
  const result = await LiveStreamService.endBroadcast(adminId, streamId, {
    byAdmin: true,
    adminId,
    reason: payload.reason,
  });

  // Log in AdminAuditLog
  await AdminAuditLog.create({
    action: 'STREAM_TERMINATED_BY_ADMIN',
    performedBy: new Types.ObjectId(adminId),
    performedByRole: adminRole,
    targetStream: stream._id,
    targetUser: stream.host,
    metadata: {
      roomId: stream.roomId,
      channelName: stream.channelName,
      terminationReason: payload.reason,
    },
  });

  // Evict control room & dashboard caches
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.ADMIN_ACTIVE_LIST);
  await RedisService.del('admin:dashboard:summary');

  // Broadcast immediate client ejection event to all viewers & host in the room
  safeEmitToRoom(`stream:${streamId}`, 'admin_force_end_stream', {
    streamId,
    reason: payload.reason,
    terminatedBy: 'admin',
  });

  return result;
};

// ==========================================
// 4. REMOTE HOST MIC MUTE
// ==========================================
const muteHost = async (
  adminId: string,
  adminRole: string,
  streamId: string,
  payload: IMuteHostPayload,
) => {
  const stream = await LiveStream.findById(streamId);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot mute host of an inactive or concluded stream',
    );
  }

  // Socket command dispatched directly to the host's private user channel
  safeEmitToRoom(`user:${stream.host.toString()}`, 'admin_user_muted', {
    streamId,
    isMuted: true,
    reason: payload.reason,
  });

  // Audit Log
  await AdminAuditLog.create({
    action: 'HOST_MUTED',
    performedBy: new Types.ObjectId(adminId),
    performedByRole: adminRole,
    targetStream: stream._id,
    targetUser: stream.host,
    metadata: {
      roomId: stream.roomId,
      reason: payload.reason,
    },
  });

  return {
    streamId: stream._id,
    hostId: stream.host,
    isMuted: true,
    reason: payload.reason,
  };
};

// ==========================================
// 5. USER MODERATION (WARN, SUSPEND, BAN, UNBAN)
// ==========================================
const takeUserModerationAction = async (
  adminId: string,
  adminRole: string,
  targetUserId: string,
  payload: IUserModerationActionPayload,
) => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Target user not found');
  }

  if (targetUser.role === USER_ROLE.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Super Administrator accounts cannot be moderated',
    );
  }

  if (targetUserId === adminId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot execute moderation actions on your own account',
    );
  }

  let auditAction: any = 'USER_WARNED';

  switch (payload.action) {
    case 'ban':
      targetUser.isBlocked = true;
      targetUser.fcmToken = null;
      auditAction = 'USER_BANNED';
      // Terminate any active sockets for the user
      safeEmitToRoom(`user:${targetUserId}`, 'admin_force_logout', {
        reason: payload.reason,
      });
      break;

    case 'unban':
      targetUser.isBlocked = false;
      auditAction = 'USER_UNBANNED';
      break;

    case 'suspend': {
      const days = payload.suspensionDurationDays || 7;
      targetUser.isSuspended = true;
      targetUser.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      auditAction = 'USER_SUSPENDED';
      safeEmitToRoom(`user:${targetUserId}`, 'admin_user_suspended', {
        suspendedUntil: targetUser.suspendedUntil.toISOString(),
        reason: payload.reason,
      });
      break;
    }

    case 'lift_suspension':
      targetUser.isSuspended = false;
      targetUser.suspendedUntil = null;
      auditAction = 'USER_UNBANNED';
      break;

    case 'warn':
      auditAction = 'USER_WARNED';
      safeEmitToRoom(`user:${targetUserId}`, 'admin_warning_issued', {
        warningMessage: payload.reason,
        issuedAt: new Date().toISOString(),
      });
      break;
  }

  await targetUser.save();

  // Create Audit Record
  await AdminAuditLog.create({
    action: auditAction,
    performedBy: new Types.ObjectId(adminId),
    performedByRole: adminRole,
    targetUser: targetUser._id,
    metadata: {
      action: payload.action,
      reason: payload.reason,
      durationDays: payload.suspensionDurationDays,
    },
  });

  await RedisService.del('admin:dashboard:summary');

  return {
    userId: targetUser._id,
    action: payload.action,
    isBlocked: targetUser.isBlocked,
    isSuspended: targetUser.isSuspended,
    suspendedUntil: targetUser.suspendedUntil,
  };
};

// ==========================================
// 6. STORIES & CLAIMS MODERATION AUDIT
// ==========================================
const reviewStoryClaim = async (
  adminId: string,
  adminRole: string,
  claimId: string,
  payload: IReviewStoryClaimPayload,
) => {
  const claim = await LiveStoryClaim.findById(claimId);
  if (!claim) {
    throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
  }

  let auditAction: any = 'CLAIM_APPROVED';

  if (payload.action === 'remove') {
    claim.isDeleted = true;
    claim.adminReviewStatus = 'removed';
    claim.adminRemovedAt = new Date();
    auditAction = 'CLAIM_REMOVED';

    // If claim was pinned on stream, unpin it
    if (claim.isPinned && claim.stream) {
      await LiveStream.findByIdAndUpdate(claim.stream, {
        $set: { pinnedClaim: null },
      });
      safeEmitToRoom(`stream:${claim.stream.toString()}`, 'story_claim_unpinned', {
        streamId: claim.stream,
        claimId: claim._id,
      });
    }
  } else if (payload.action === 'flag') {
    claim.adminReviewStatus = 'flagged';
    auditAction = 'CLAIM_FLAGGED';
  } else {
    claim.adminReviewStatus = 'approved';
    auditAction = 'CLAIM_APPROVED';
  }

  claim.adminReviewedBy = new Types.ObjectId(adminId);
  claim.adminReviewNotes = payload.notes || '';
  await claim.save();

  // Audit Record
  await AdminAuditLog.create({
    action: auditAction,
    performedBy: new Types.ObjectId(adminId),
    performedByRole: adminRole,
    targetClaim: claim._id,
    targetStream: claim.stream,
    targetUser: claim.applicant,
    metadata: {
      reviewAction: payload.action,
      notes: payload.notes,
    },
  });

  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(claim.giftItem.toString()),
  );
  if (claim.stream) {
    await RedisService.del(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(claim.stream.toString()),
    );
  }
  return claim;
};

// ==========================================
// 7. ADMIN AUDIT LOGS
// ==========================================
const getAdminAuditLogs = async (query: Record<string, any>) => {
  const baseQuery = AdminAuditLog.find()
    .populate('performedBy', 'fullName email role')
    .populate('targetUser', 'fullName email')
    .populate('targetStream', 'channelName roomId');

  const auditQueryBuilder = new QueryBuilder(baseQuery, query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await auditQueryBuilder.countTotal();
  const data = await auditQueryBuilder.modelQuery;

  return { meta, data };
};

// ==========================================
// 8. SUBSCRIPTION REVENUE ANALYTICS
// ==========================================
const getRevenueAnalytics = async (query: {
  startDate?: string;
  endDate?: string;
}): Promise<IRevenueAnalytics> => {
  const isDefault = !query.startDate && !query.endDate;
  const cacheKey = 'admin:revenue:summary';

  if (isDefault) {
    const cached = await RedisService.get<IRevenueAnalytics>(cacheKey);
    if (cached) return cached;
  }

  // 1. Total Succeeded Revenue in Cents
  const totalRevAggregation = await PaymentTransaction.aggregate([
    { $match: { status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$amountInCents' } } },
  ]);
  const totalRevenueInCents = totalRevAggregation[0]?.total || 0;

  // 2. Active Subscribers by Tier
  const tierAggregation = await User.aggregate([
    { $match: { isDeleted: false, isBlocked: false } },
    { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } },
  ]);

  const activeSubscribersByTier = {
    free: 0,
    premium: 0,
    pro: 0,
  };

  tierAggregation.forEach((t) => {
    if (t._id === 'premium') activeSubscribersByTier.premium = t.count;
    else if (t._id === 'pro') activeSubscribersByTier.pro = t.count;
    else activeSubscribersByTier.free = t.count;
  });

  // Monthly recurring revenue (e.g. Premium=$9.99 [999 cents], Pro=$24.99 [2499 cents])
  const recurringMonthlyInCents =
    activeSubscribersByTier.premium * 999 + activeSubscribersByTier.pro * 2499;

  // 3. Time-Series Daily Revenue
  const dateMatch: Record<string, any> = { status: 'succeeded' };
  if (query.startDate || query.endDate) {
    dateMatch.createdAt = {};
    if (query.startDate) dateMatch.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) dateMatch.createdAt.$lte = new Date(query.endDate);
  }

  const timeSeriesAgg = await PaymentTransaction.aggregate([
    { $match: dateMatch },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        amountInCents: { $sum: '$amountInCents' },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const timeSeries = timeSeriesAgg.map((item) => ({
    date: item._id,
    amountInCents: item.amountInCents,
    transactionCount: item.transactionCount,
  }));

  // Churn rate calculation
  const totalCanceled = await UserSubscription.countDocuments({
    status: 'canceled',
  });
  const totalActive = await UserSubscription.countDocuments({
    status: 'active',
  });
  const churnRatePercentage =
    totalActive + totalCanceled > 0
      ? Number(((totalCanceled / (totalActive + totalCanceled)) * 100).toFixed(2))
      : 0;

  const analytics: IRevenueAnalytics = {
    totalRevenueInCents,
    recurringMonthlyInCents,
    activeSubscribersByTier,
    churnRatePercentage,
    timeSeries,
  };

  if (isDefault) {
    await RedisService.set(cacheKey, analytics, 900); // 15 min TTL
  }

  return analytics;
};

// ==========================================
// LEGACY COMPATIBILITY HANDLERS
// ==========================================
const blockedUser = async (userData: IJwtPayload, targetId: string) => {
  return await takeUserModerationAction(userData.userId, userData.role, targetId, {
    action: 'ban',
    reason: 'Admin blocked user account',
  });
};

const deleteUser = async (userData: IJwtPayload, targetId: string) => {
  const user = await User.findById(targetId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  if (user.role === USER_ROLE.ADMIN || user.role === USER_ROLE.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot delete another administrator account',
    );
  }
  user.isDeleted = true;
  await user.save();
  return user;
};

export const adminService = {
  getTelemetryOverview,
  getActiveLiveStreamsControlRoom,
  forceTerminateStream,
  muteHost,
  takeUserModerationAction,
  reviewStoryClaim,
  getAdminAuditLogs,
  getRevenueAnalytics,
  blockedUser,
  deleteUser,
};
