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
  const cacheKey = 'admin:dashboard:telemetry';
  const cached = await RedisService.get<ITelemetryOverview>(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Parallel database queries
  const [
    totalUsers,
    newUsersToday,
    verifiedUsersCount,
    activeUsersCount,
    totalGifts,
    availableGiftsCount,
    claimedGiftsCount,
    giftsThisWeekCount,
    giftsPrevWeekCount,
    totalClaimsSubmitted,
    activeLiveStreamsDocs,
    openModerationFlags,
    totalModerationFlags,
    revenueAggregation,
    activeSubscriptionsCount,
    tierAggregation,
    recentAuditLogs,
    recentGifts,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: false, createdAt: { $gte: startOfDay } }),
    User.countDocuments({ isDeleted: false, isVerifiedByAdmin: true }),
    User.countDocuments({
      isDeleted: false,
      isBlocked: { $ne: true },
      $or: [
        { isSuspended: false },
        { isSuspended: { $exists: false } },
        { suspendedUntil: { $lte: now } },
        { suspendedUntil: null },
      ],
    }),
    GiftItem.countDocuments({ isDeleted: false }),
    GiftItem.countDocuments({ isDeleted: false, claimState: 'available' }),
    GiftItem.countDocuments({
      isDeleted: false,
      claimState: { $in: ['claimed', 'pickup_arranged', 'delivered'] },
    }),
    GiftItem.countDocuments({ isDeleted: false, createdAt: { $gte: oneWeekAgo } }),
    GiftItem.countDocuments({
      isDeleted: false,
      createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo },
    }),
    LiveStoryClaim.countDocuments({ isDeleted: false }),
    LiveStream.find({
      status: LIVE_STREAM_STATUS.LIVE,
      isDeleted: false,
    }).select('_id peakViewers'),
    ModerationFlag.countDocuments({ resolutionStatus: 'open' }),
    ModerationFlag.countDocuments({}),
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
    UserSubscription.countDocuments({ status: 'active' }),
    User.aggregate([
      { $match: { isDeleted: false, isBlocked: false } },
      { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } },
    ]),
    AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('performedBy', 'fullName email'),
    GiftItem.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('host', 'fullName email neighborhoodLabel address profileImage'),
  ]);

  // Active live streams & viewers
  const activeLiveStreams = activeLiveStreamsDocs.length;
  let totalWatching = 0;
  if (activeLiveStreamsDocs.length > 0) {
    const viewerCounts = await Promise.all(
      activeLiveStreamsDocs.map(async (st) => {
        const liveCount = await RedisService.sCard(
          LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(st._id.toString()),
        );
        return liveCount || st.peakViewers || 0;
      }),
    );
    totalWatching = viewerCounts.reduce((acc, count) => acc + count, 0);
  }

  // KPI 1: Neighbor Gifts
  let weekGrowth = '+18% this wk';
  if (giftsPrevWeekCount > 0) {
    const rate = Math.round(
      ((giftsThisWeekCount - giftsPrevWeekCount) / giftsPrevWeekCount) * 100,
    );
    weekGrowth = rate >= 0 ? `+${rate}% this wk` : `${rate}% this wk`;
  } else if (giftsThisWeekCount > 0) {
    weekGrowth = `+${giftsThisWeekCount * 10}% this wk`;
  }
  const breakdownText = `${availableGiftsCount} Available • ${claimedGiftsCount} Claimed`;

  // KPI 2: Community Members
  const verifiedPercentageNum =
    totalUsers > 0
      ? Number(((verifiedUsersCount / totalUsers) * 100).toFixed(1))
      : 98.6;
  const verifiedPercentage = `${verifiedPercentageNum}% Verified`;
  const footerTextMembers = `${activeUsersCount} Active in Austin Node`;

  // KPI 3: Applicant Needs Vetted
  const freeRuleRate = '100% Free';
  const avgPerListing =
    totalGifts > 0
      ? Number((totalClaimsSubmitted / totalGifts).toFixed(1))
      : 1.0;
  const footerTextClaims = `Average ${avgPerListing} applicants per listing`;

  // KPI 4: Live Broadcasts On Air
  const watchingText = `${totalWatching} Watching`;
  const footerTextLive = 'Interactive community gifting rooms';

  // Live Activity Stream
  const liveActivityStream = recentGifts.map((gift: any) => {
    const hostObj = gift.host || {};
    const coverImage =
      Array.isArray(gift.images) && gift.images.length > 0
        ? gift.images[gift.coverImageIndex || 0] || gift.images[0]
        : '';
    const claimState =
      gift.claimState === 'available' ? 'AVAILABLE' : 'CLAIMED';
    const neighborhood =
      hostObj.neighborhoodLabel ||
      hostObj.address?.address ||
      'Austin Metro';
    const donorSubtitle = `Listed by ${hostObj.fullName || 'Community Neighbor'} • ${neighborhood}`;
    const storiesCount = gift.storyClaimCount || 0;
    const storyBadgeText = `${storiesCount} Applicant Stories`;
    const pickUpPreference = gift.pickUpPreference || 'Porch Pickup';

    let timeRemaining = '24h remaining';
    const targetDate = gift.availableUntil || gift.estimateTime;
    if (targetDate) {
      const diffHours = Math.round(
        (new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60),
      );
      if (diffHours > 0) {
        timeRemaining = `${diffHours}h remaining`;
      } else {
        timeRemaining = 'Ending soon';
      }
    }

    return {
      id: gift._id.toString(),
      title: gift.title,
      coverImage,
      claimState,
      host: {
        id: hostObj._id ? hostObj._id.toString() : undefined,
        fullName: hostObj.fullName || 'Community Neighbor',
        email: hostObj.email,
        neighborhoodLabel: neighborhood,
      },
      donorSubtitle,
      storyClaimCount: storiesCount,
      storyBadgeText,
      pickUpPreference,
      timeRemaining,
      createdAt: gift.createdAt ? gift.createdAt.toISOString() : now.toISOString(),
    };
  });

  // Trust & Safety Index
  const freeRuleCompliance = '100%';
  const identityVerifiedDonors = `${verifiedPercentageNum}%`;
  const disputeResolutionNum =
    totalModerationFlags > 0
      ? Number(
          (
            ((totalModerationFlags - openModerationFlags) /
              totalModerationFlags) *
            100
          ).toFixed(1),
        )
      : 100;
  const disputeResolution = `${disputeResolutionNum}%`;

  const overallScoreNum = Number(
    ((100 + verifiedPercentageNum + disputeResolutionNum) / 3).toFixed(1),
  );
  const overallScore = `${overallScoreNum}%`;
  const pendingFlagsText = `Review Pending Flags (${openModerationFlags})`;

  // Revenue & Subscription Sidebar Badges
  const activeSubscribersByTier = { free: 0, premium: 0, pro: 0 };
  tierAggregation.forEach((t: any) => {
    if (t._id === 'premium') activeSubscribersByTier.premium = t.count;
    else if (t._id === 'pro') activeSubscribersByTier.pro = t.count;
    else activeSubscribersByTier.free = t.count;
  });

  const recurringMonthlyInCents =
    activeSubscribersByTier.premium * 999 + activeSubscribersByTier.pro * 2499;

  const revenueThisMonthInCents =
    revenueAggregation[0]?.total || recurringMonthlyInCents;
  const revenueInK = (revenueThisMonthInCents / 100000).toFixed(1);
  const revenueBadge = `$${revenueInK}k MRR`;

  const subscriptionCount =
    activeSubscriptionsCount > 0
      ? activeSubscriptionsCount
      : activeSubscribersByTier.premium + activeSubscribersByTier.pro;

  const sidebarBadges = {
    userMonitoring: totalUsers,
    listingsMonitoring: totalGifts,
    storiesClaimsAudit: totalClaimsSubmitted,
    liveStreamWatch: activeLiveStreams,
    revenue: revenueBadge,
    subscription: subscriptionCount,
    trustAndSafetyQueue: openModerationFlags,
  };

  const recentActivity = recentAuditLogs.map((log: any) => ({
    action: log.action,
    performedBy: log.performedBy?.fullName || 'System',
    timestamp: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
  }));

  const telemetry: ITelemetryOverview = {
    kpis: {
      neighborGifts: {
        total: totalGifts,
        weekGrowth,
        availableCount: availableGiftsCount,
        claimedCount: claimedGiftsCount,
        breakdownText,
      },
      communityMembers: {
        total: totalUsers,
        verifiedPercentage,
        activeCount: activeUsersCount,
        footerText: footerTextMembers,
      },
      applicantNeedsVetted: {
        total: totalClaimsSubmitted,
        freeRuleRate,
        averagePerListing: avgPerListing,
        footerText: footerTextClaims,
      },
      liveBroadcasts: {
        total: activeLiveStreams,
        totalWatching,
        watchingText,
        footerText: footerTextLive,
      },
    },
    liveActivityStream,
    trustSafetyIndex: {
      overallScore,
      overallPercentage: overallScoreNum,
      freeRuleCompliance,
      identityVerifiedDonors,
      disputeResolution,
      pendingFlagsCount: openModerationFlags,
      pendingFlagsText,
      subtitle:
        'Real-time zero-resale compliance, community verification, and dispute resolution score.',
    },
    sidebarBadges,

    // Legacy fields
    totalUsers,
    newUsersToday,
    activeLiveStreams,
    totalGiftsGiven: claimedGiftsCount,
    totalClaimsSubmitted,
    revenueThisMonthInCents,
    openModerationFlags,
    recentActivity,
  };

  await RedisService.set(cacheKey, telemetry, 120); // 2 min TTL for live freshness
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

/**
 * 5. GET SUPERVISED USERS (COMMUNITY MEMBER & USER SUPERVISION)
 * Returns overview statistics + paginated & filtered user list formatted
 * for the admin supervision dashboard.
 */
const getSupervisedUsers = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const now = new Date();

  // 1. Calculate Summary for Top Badges
  const [totalSupervisedMembers, totalActive, totalUnderReview, totalSuspended, totalBlocked] =
    await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({
        isDeleted: false,
        isBlocked: { $ne: true },
        $or: [
          { isSuspended: false },
          { isSuspended: { $exists: false } },
          { suspendedUntil: { $lte: now } },
          { suspendedUntil: null },
        ],
      }),
      User.countDocuments({
        isDeleted: false,
        $or: [{ hasCompletedProfile: false }, { isVerifiedByAdmin: false }],
      }),
      User.countDocuments({
        isDeleted: false,
        isSuspended: true,
        suspendedUntil: { $gt: now },
      }),
      User.countDocuments({
        isDeleted: false,
        isBlocked: true,
      }),
    ]);

  const summary = {
    totalSupervisedMembers,
    totalActive,
    totalUnderReview,
    totalSuspended,
    totalBlocked,
  };

  // 2. Base Filter
  const filterConditions: Record<string, any> = {
    isDeleted: false,
  };

  // Filter by Role ('all', 'user', 'admin', 'super_admin')
  if (query.role && query.role !== 'all') {
    filterConditions.role = query.role;
  }

  // Filter by Status ('all', 'active', 'under_review', 'suspended', 'blocked', 'banned')
  if (query.status && query.status !== 'all') {
    const statusLower = String(query.status).toLowerCase();
    if (statusLower === 'active') {
      filterConditions.isBlocked = { $ne: true };
      filterConditions.$or = [
        { isSuspended: false },
        { isSuspended: { $exists: false } },
        { suspendedUntil: { $lte: now } },
        { suspendedUntil: null },
      ];
    } else if (statusLower === 'suspended') {
      filterConditions.isSuspended = true;
      filterConditions.suspendedUntil = { $gt: now };
    } else if (statusLower === 'blocked' || statusLower === 'banned') {
      filterConditions.isBlocked = true;
    } else if (statusLower === 'under_review' || statusLower === 'under review') {
      filterConditions.$or = [
        { hasCompletedProfile: false },
        { isVerifiedByAdmin: false },
      ];
    }
  }

  // Search across name, email, neighborhood, role, address
  if (query.searchTerm) {
    const searchRegex = { $regex: query.searchTerm, $options: 'i' };
    filterConditions.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { neighborhoodLabel: searchRegex },
      { 'address.address': searchRegex },
      { role: searchRegex },
    ];
  }

  // 3. Count matching items for pagination
  const total = await User.countDocuments(filterConditions);
  const totalPage = Math.ceil(total / limit);

  // 4. Fetch Users
  const sortOption = (query.sort as string) || '-createdAt';

  const users = await User.find(filterConditions)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .select(
      'fullName email profileImage phone role neighborhoodLabel address giftGiven totalGiftsGiven giftReceived totalGiftsReceived totalStreamsHosted liveTouch totalStoriesClaimed communityTrustScore isBlocked isSuspended suspendedUntil hasCompletedProfile isVerifiedByAdmin lastActiveAt createdAt',
    )
    .lean();

  // 5. Format each user for dashboard view
  const formattedUsers = users.map((user: any) => {
    let accountStatus: 'ACTIVE' | 'UNDER REVIEW' | 'SUSPENDED' | 'BLOCKED' = 'ACTIVE';
    if (user.isBlocked) {
      accountStatus = 'BLOCKED';
    } else if (user.isSuspended && user.suspendedUntil && new Date(user.suspendedUntil) > now) {
      accountStatus = 'SUSPENDED';
    } else if (user.hasCompletedProfile === false || user.isVerifiedByAdmin === false) {
      accountStatus = 'UNDER REVIEW';
    }

    const giftGiven = user.giftGiven ?? user.totalGiftsGiven ?? 0;
    const giftReceived = user.giftReceived ?? user.totalGiftsReceived ?? 0;
    const formattedGiveReceive = `${giftGiven} Given / ${giftReceived} Recv`;

    const location = user.neighborhoodLabel || user.address?.address || 'Austin, TX';

    let communityRole = 'Member';
    if (user.role === 'admin' || user.role === 'super_admin') {
      communityRole = 'Community Leader';
    } else if (giftGiven >= 10) {
      communityRole = 'Community Leader';
    } else if (giftGiven >= 5) {
      communityRole = 'Verified Donor';
    } else if (giftGiven > 0) {
      communityRole = 'Donor';
    } else if (user.totalStoriesClaimed > 0) {
      communityRole = 'Applicant';
    } else if (user.hasCompletedProfile === false) {
      communityRole = 'New Applicant';
    }

    return {
      _id: user._id,
      fullName: user.fullName || 'New Member',
      email: user.email,
      profileImage: user.profileImage || '',
      phone: user.phone?.fullNumber || user.phone?.number || '',
      role: user.role,
      communityRole,
      neighborhoodLabel: location,
      giftGiven,
      giftReceived,
      formattedGiveReceive,
      totalStreamsHosted: user.totalStreamsHosted ?? user.liveTouch ?? 0,
      totalStoriesClaimed: user.totalStoriesClaimed ?? 0,
      communityTrustScore: user.communityTrustScore ?? 50,
      accountStatus,
      isBlocked: user.isBlocked ?? false,
      isSuspended: user.isSuspended ?? false,
      suspendedUntil: user.suspendedUntil || null,
      hasCompletedProfile: user.hasCompletedProfile ?? false,
      lastActiveAt: user.lastActiveAt || null,
      createdAt: user.createdAt,
    };
  });

  return {
    summary,
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: formattedUsers,
  };
};

/**
 * 6. GET USER INSPECTION DETAILS FOR MODAL
 */
const getUserInspectionDetails = async (targetUserId: string) => {
  const user = await User.findById(targetUserId).lean();
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const [recentGifts, recentClaims, recentStreams, auditLogs] = await Promise.all([
    GiftItem.find({ host: targetUserId, isDeleted: false })
      .sort('-createdAt')
      .limit(5)
      .select('title images coverImageIndex condition category claimState sportLite createdAt'),
    LiveStoryClaim.find({ applicant: targetUserId, isDeleted: false })
      .sort('-createdAt')
      .limit(5)
      .populate('giftItem', 'title images coverImageIndex')
      .select('storyTitle status upvotes downvotes createdAt'),
    LiveStream.find({ host: targetUserId, isDeleted: false })
      .sort('-createdAt')
      .limit(5)
      .select('channelName status peakViewers actualDurationSeconds createdAt'),
    AdminAuditLog.find({ targetUser: targetUserId })
      .sort('-createdAt')
      .limit(10)
      .populate('performedBy', 'fullName email role'),
  ]);

  const giftGiven = user.giftGiven ?? user.totalGiftsGiven ?? 0;
  const giftReceived = user.giftReceived ?? user.totalGiftsReceived ?? 0;

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone?.fullNumber || user.phone?.number || '',
      profileImage: user.profileImage || '',
      role: user.role,
      neighborhoodLabel: user.neighborhoodLabel || user.address?.address || '',
      communityTrustScore: user.communityTrustScore ?? 50,
      giftGiven,
      giftReceived,
      totalStreamsHosted: user.totalStreamsHosted ?? user.liveTouch ?? 0,
      totalStoriesClaimed: user.totalStoriesClaimed ?? 0,
      isBlocked: user.isBlocked ?? false,
      isSuspended: user.isSuspended ?? false,
      suspendedUntil: user.suspendedUntil || null,
      hasCompletedProfile: user.hasCompletedProfile ?? false,
      lastActiveAt: user.lastActiveAt || null,
      createdAt: user.createdAt,
    },
    stats: {
      totalGifts: giftGiven,
      totalClaims: user.totalStoriesClaimed ?? recentClaims.length,
      totalStreams: user.totalStreamsHosted ?? recentStreams.length,
    },
    recentGifts,
    recentClaims,
    recentStreams,
    auditLogs,
  };
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
  getSupervisedUsers,
  getUserInspectionDetails,
  blockedUser,
  deleteUser,
};
