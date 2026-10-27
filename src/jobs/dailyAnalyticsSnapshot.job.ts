import cron from 'node-cron';
import { User } from '../app/modules/user/user.models';
import { GiftItem } from '../app/modules/GiftItem/giftItem.model';
import { LiveStream } from '../app/modules/LiveStream/liveStream.model';
import { LiveStoryClaim } from '../app/modules/StoryClaim/storyClaim.model';
import { ModerationFlag } from '../app/modules/LiveComment/liveComment.model';
import {
  PaymentTransaction,
  UserSubscription,
} from '../app/modules/Subscription/subscription.model';
import { SystemAnalytics } from '../app/modules/AuditLog/auditLog.model';
import logger from '../app/utils/logger';

export const takeDailyAnalyticsSnapshot = async (): Promise<void> => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      activeUsersToday,
      blockedUsers,
      totalGiftsPublished,
      giftsPublishedToday,
      giftsClaimedToday,
      giftsDeliveredToday,
      totalStreamsHosted,
      streamsHostedToday,
      totalClaimsSubmitted,
      claimsSubmittedToday,
      claimsAwardedToday,
      totalRevenueResult,
      revenueTodayResult,
      activeSubscriptions,
      churnsToday,
      openFlags,
      flagsResolvedToday,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ lastActiveAt: { $gte: twentyFourHoursAgo } }),
      User.countDocuments({ isBlocked: true }),
      GiftItem.countDocuments({ isDeleted: false }),
      GiftItem.countDocuments({ createdAt: { $gte: startOfDay } }),
      GiftItem.countDocuments({
        claimState: 'claimed',
        claimedAt: { $gte: startOfDay },
      }),
      GiftItem.countDocuments({
        claimState: 'delivered',
        updatedAt: { $gte: startOfDay },
      }),
      LiveStream.countDocuments({ isDeleted: false }),
      LiveStream.countDocuments({ startedAt: { $gte: startOfDay } }),
      LiveStoryClaim.countDocuments({ isDeleted: false }),
      LiveStoryClaim.countDocuments({ createdAt: { $gte: startOfDay } }),
      LiveStoryClaim.countDocuments({
        status: 'awarded',
        awardedAt: { $gte: startOfDay },
      }),
      PaymentTransaction.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amountInCents' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: { status: 'succeeded', createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$amountInCents' } } },
      ]),
      UserSubscription.countDocuments({ status: 'active' }),
      UserSubscription.countDocuments({
        status: 'canceled',
        updatedAt: { $gte: startOfDay },
      }),
      ModerationFlag.countDocuments({ resolutionStatus: 'open' }),
      ModerationFlag.countDocuments({
        resolutionStatus: { $in: ['resolved_no_action', 'resolved_action_taken'] },
        resolvedAt: { $gte: startOfDay },
      }),
    ]);

    const totalRevenueCents = totalRevenueResult[0]?.total || 0;
    const revenueTodayCents = revenueTodayResult[0]?.total || 0;

    await SystemAnalytics.findOneAndUpdate(
      { date: startOfDay },
      {
        $set: {
          totalUsers,
          newUsersToday,
          activeUsersToday,
          blockedUsers,
          totalGiftsPublished,
          giftsPublishedToday,
          giftsClaimedToday,
          giftsDeliveredToday,
          totalStreamsHosted,
          streamsHostedToday,
          peakConcurrentViewersToday: 0,
          totalViewMinutesToday: 0,
          totalClaimsSubmitted,
          claimsSubmittedToday,
          claimsAwardedToday,
          totalRevenueCents,
          revenueTodayCents,
          activeSubscriptions,
          newSubscriptionsToday: 0,
          churnsToday,
          openFlags,
          flagsResolvedToday,
        },
      },
      { upsert: true, new: true },
    );

    logger.info(`[DailyAnalyticsSnapshot] Snapshot successfully recorded for ${startOfDay.toISOString().split('T')[0]}`);
  } catch (error) {
    logger.error('[DailyAnalyticsSnapshot] Failed to record snapshot:', error);
  }
};

/**
 * Schedule daily cron at 23:59:00 every night
 */
export const startDailyAnalyticsJob = (): void => {
  cron.schedule('59 23 * * *', async () => {
    logger.info('[DailyAnalyticsSnapshot] Triggering midnight KPI snapshot...');
    await takeDailyAnalyticsSnapshot();
  });
};
