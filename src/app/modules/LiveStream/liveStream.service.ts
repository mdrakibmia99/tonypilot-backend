import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import { RedisService } from '../../redis';
import { getIO } from '../../../socket';
import { User } from '../user/user.models';
import { GiftItem } from '../GiftItem/giftItem.model';
import { GIFT_CLAIM_STATE } from '../GiftItem/giftItem.constants';
import { TIER_LIMITS } from '../Subscription/subscription.constants';
import { LiveStream } from './liveStream.model';
import { LiveStoryClaim } from '../StoryClaim/storyClaim.model';
import { STORY_CLAIM_REDIS_KEYS } from '../StoryClaim/storyClaim.constants';
import {
  LIVE_STREAM_STATUS,
  LIVE_STREAM_REDIS_KEYS,
} from './liveStream.constants';
import {
  generateHostTokens,
  generateViewerTokens,
  verifyZegoWebhookSignature,
} from './zego.utils';
import QueryBuilder from '../../builder/QueryBuilder';
import { LIVE_STREAM_SEARCHABLE_FIELDS } from './liveStream.constants';

const safeEmitToRoom = (room: string, event: string, payload: any) => {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch {
    // Socket server may not be active in test environments
  }
};

const safeEmitGlobal = (event: string, payload: any) => {
  try {
    const io = getIO();
    io.emit(event, payload);
  } catch {
    // Socket server may not be active in test environments
  }
};

/**
 * 1. Pre-Live Studio Initialization
 * Prepares the live room, validates host quota and gift item ownership,
 * and mints host RTC/ZIM publisher tokens.
 */
const preLiveInit = async (
  userId: string,
  payload: {
    giftItemId: string;
    channelName: string;
    timerDurationSeconds?: number;
  },
) => {
  const user = await User.findById(userId);
  if (!user || user.isBlocked || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User account is not active');
  }

  if (user.isSuspended && user.suspendedUntil && user.suspendedUntil > new Date()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account is suspended from streaming until ${user.suspendedUntil.toISOString()}`,
    );
  }

  // 1. Enforce Subscription Tier Limits for Monthly Streaming
  const tier = (user.subscriptionTier || 'free') as keyof typeof TIER_LIMITS;
  const tierLimit = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const streamCountThisMonth = await LiveStream.countDocuments({
    host: userId,
    createdAt: { $gte: startOfMonth },
    status: { $ne: LIVE_STREAM_STATUS.SCHEDULED }, // Count only started/ended streams
  });

  if (
    tierLimit.maxLiveStreamsPerMonth !== -1 &&
    streamCountThisMonth >= tierLimit.maxLiveStreamsPerMonth
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Monthly live streaming limit (${tierLimit.maxLiveStreamsPerMonth}) reached for ${tier} tier. Please upgrade your subscription to host more streams.`,
    );
  }

  // 2. Validate Duration Constraints
  const maxAllowedDurationSec = tierLimit.maxStreamDurationMinutes * 60;
  let requestedDuration = payload.timerDurationSeconds || 900;
  if (requestedDuration > maxAllowedDurationSec) {
    requestedDuration = maxAllowedDurationSec;
  }

  // 3. Verify GiftItem
  const giftItem = await GiftItem.findById(payload.giftItemId);
  if (!giftItem || giftItem.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Selected gift item was not found');
  }

  if (giftItem.host.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only host a live stream for gifts you have posted',
    );
  }

  if (giftItem.claimState !== GIFT_CLAIM_STATE.AVAILABLE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Gift item is currently in '${giftItem.claimState}' state and cannot be used for a new stream`,
    );
  }

  // Ensure gift is not already active in another scheduled or live stream
  const activeStreamWithGift = await LiveStream.findOne({
    giftItem: payload.giftItemId,
    status: { $in: [LIVE_STREAM_STATUS.SCHEDULED, LIVE_STREAM_STATUS.LIVE] },
  });
  if (activeStreamWithGift) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This gift item is already associated with an ongoing or scheduled live stream session',
    );
  }

  // 4. Generate Unique Room ID
  const roomId = `tony_room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 5. Generate ZEGOCLOUD Publisher Tokens
  const hostTokens = generateHostTokens({
    userId,
    roomId,
    effectiveTimeInSeconds: requestedDuration + 3600, // Duration + 1hr buffer
  });

  // 6. Create LiveStream Record in DB
  const stream = await LiveStream.create({
    roomId,
    channelName: payload.channelName.trim(),
    host: userId,
    giftItem: payload.giftItemId,
    status: LIVE_STREAM_STATUS.SCHEDULED,
    scheduledAt: new Date(),
    timerDurationSeconds: requestedDuration,
  });

  // Associate the stream and all stories collected since the gift was published.
  giftItem.associatedStream = stream._id as Types.ObjectId;
  await giftItem.save();

  const claimLinkResult = await LiveStoryClaim.updateMany(
    { giftItem: giftItem._id, isDeleted: false },
    { $set: { stream: stream._id } },
  );
  stream.totalClaimsReceived = claimLinkResult.matchedCount;
  await stream.save();
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(giftItem._id.toString()),
  );
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(stream._id.toString()),
  );

  // 7. Initialize Ephemeral Room State in Redis
  const stateKey = LIVE_STREAM_REDIS_KEYS.STREAM_STATE(stream._id.toString());
  await RedisService.set(
    stateKey,
    {
      streamId: stream._id.toString(),
      roomId,
      hostId: userId,
      status: LIVE_STREAM_STATUS.SCHEDULED,
      timerDurationSeconds: requestedDuration,
      giftItemId: payload.giftItemId,
    },
    LIVE_STREAM_REDIS_KEYS.EPHEMERAL_TTL,
  );

  return {
    streamId: stream._id,
    roomId,
    channelName: stream.channelName,
    rtcToken: hostTokens.rtcToken,
    zimToken: hostTokens.zimToken,
    appId: hostTokens.appId,
    timerDurationSeconds: requestedDuration,
    giftItem,
  };
};

/**
 * 2. Start Broadcast
 * Transitions stream from 'scheduled' to 'live', initializes room timer,
 * and broadcasts discovery announcement.
 */
const startBroadcast = async (userId: string, streamId: string) => {
  const stream = await LiveStream.findById(streamId);
  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream session not found');
  }

  if (stream.host.toString() !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only the host can start this broadcast');
  }

  if (stream.status === LIVE_STREAM_STATUS.LIVE) {
    return {
      streamId: stream._id,
      status: stream.status,
      startedAt: stream.startedAt,
    };
  }

  if (
    stream.status === LIVE_STREAM_STATUS.ENDED ||
    stream.status === LIVE_STREAM_STATUS.TERMINATED_BY_ADMIN
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot start a stream that has already ${stream.status}`,
    );
  }

  const now = new Date();
  stream.status = LIVE_STREAM_STATUS.LIVE;
  stream.startedAt = now;
  await stream.save();

  // Increment host's total streams counter
  await User.findByIdAndUpdate(userId, { $inc: { totalStreamsHosted: 1 } });

  // Update Redis Room State
  const stateKey = LIVE_STREAM_REDIS_KEYS.STREAM_STATE(streamId);
  const existingState = (await RedisService.get(stateKey)) || {};
  await RedisService.set(
    stateKey,
    {
      ...existingState,
      status: LIVE_STREAM_STATUS.LIVE,
      startedAt: now.toISOString(),
    },
    LIVE_STREAM_REDIS_KEYS.EPHEMERAL_TTL,
  );

  // Invalidate Active Streams Cache
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST);
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.ADMIN_ACTIVE_LIST);

  // Broadcast Real-Time Notification
  safeEmitGlobal('stream_started', {
    streamId: stream._id,
    channelName: stream.channelName,
    startedAt: now.toISOString(),
  });

  return {
    streamId: stream._id,
    status: stream.status,
    startedAt: stream.startedAt,
  };
};

/**
 * 3. Join Live Stream
 * Generates audience RTC & ZIM tokens for viewer, updates live viewer counts
 * in Redis Sets, and tracks peak viewer records.
 */
const joinLiveStream = async (userId: string | null, streamId: string) => {
  const stream = await LiveStream.findById(streamId)
    .populate('host', 'fullName profileImage neighborhoodLabel')
    .populate('giftItem')
    .populate('pinnedClaim');

  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream session not found');
  }

  if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Live stream is currently in '${stream.status}' state and not actively broadcasting`,
    );
  }

  const viewerIdentifier = userId || `guest_${Math.random().toString(36).substring(2, 9)}`;

  // Generate Subscriber Tokens
  const viewerTokens = generateViewerTokens({
    userId: viewerIdentifier,
    roomId: stream.roomId,
    effectiveTimeInSeconds: stream.timerDurationSeconds + 3600,
  });

  // Track Viewer Presence in Redis Set
  const viewersKey = LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId);
  await RedisService.sAdd(viewersKey, viewerIdentifier);
  await RedisService.expire(viewersKey, LIVE_STREAM_REDIS_KEYS.EPHEMERAL_TTL);

  const currentViewerCount = await RedisService.sCard(viewersKey);

  // Update Peak Viewers if exceeded
  if (currentViewerCount > stream.peakViewers) {
    stream.peakViewers = currentViewerCount;
    await LiveStream.findByIdAndUpdate(streamId, {
      peakViewers: currentViewerCount,
      $inc: { totalReach: 1 },
    });
  } else {
    await LiveStream.findByIdAndUpdate(streamId, {
      $inc: { totalReach: 1 },
    });
  }

  // Notify Room of Viewer Count Update
  safeEmitToRoom(`stream:${streamId}`, 'viewer_count_update', {
    streamId,
    viewerCount: currentViewerCount,
  });

  return {
    streamId: stream._id,
    roomId: stream.roomId,
    rtcToken: viewerTokens.rtcToken,
    zimToken: viewerTokens.zimToken,
    appId: viewerTokens.appId,
    currentViewerCount,
    giftItem: stream.giftItem,
    pinnedClaim: stream.pinnedClaim || null,
    startedAt: stream.startedAt,
    timerDurationSeconds: stream.timerDurationSeconds,
  };
};

/**
 * 4. Get Active Streams List ("Others Live" / "More Live Today")
 * Cache-aside with 30s TTL via Redis.
 */
const getActiveStreams = async (query: Record<string, any>) => {
  const isDefaultQuery = !query.searchTerm && (!query.page || query.page === '1');

  // Try Redis cache for default public queries
  if (isDefaultQuery) {
    const cachedData = await RedisService.get(LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch {
        // Fallback to DB if parse fails
      }
    }
  }

  const baseQuery = LiveStream.find({
    status: LIVE_STREAM_STATUS.LIVE,
    isDeleted: false,
  })
    .populate('host', 'fullName profileImage neighborhoodLabel')
    .populate('giftItem', 'title images category condition');

  const streamQueryBuilder = new QueryBuilder(baseQuery, query)
    .search(LIVE_STREAM_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await streamQueryBuilder.countTotal();
  const rawData = await streamQueryBuilder.modelQuery;

  // Enrich with live viewer count from Redis for each stream
  const enrichedData = await Promise.all(
    rawData.map(async (st: any) => {
      const liveCount = await RedisService.sCard(
        LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(st._id.toString()),
      );
      const obj = st.toObject();
      obj.currentViewerCount = liveCount || st.peakViewers || 0;
      return obj;
    }),
  );

  const result = {
    meta,
    data: enrichedData,
  };

  if (isDefaultQuery) {
    await RedisService.set(
      LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST,
      JSON.stringify(result),
      LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST_TTL,
    );
  }

  return result;
};

/**
 * 5. End Broadcast
 * Calculates final air time, archives viewer counts, writes wrapUpSummary,
 * and flushes ephemeral Redis keys.
 */
const endBroadcast = async (
  userId: string,
  streamId: string,
  options?: {
    byAdmin?: boolean;
    adminId?: string;
    reason?: string;
  },
) => {
  const stream = await LiveStream.findById(streamId)
    .populate('winner', 'fullName profileImage')
    .populate('giftItem', 'title coverImageIndex images');

  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream session not found');
  }

  // Check authorization
  if (!options?.byAdmin && stream.host.toString() !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only the host or an administrator can end this stream');
  }

  // If already ended, return existing wrap-up
  if (
    stream.status === LIVE_STREAM_STATUS.ENDED ||
    stream.status === LIVE_STREAM_STATUS.TERMINATED_BY_ADMIN
  ) {
    return {
      streamId: stream._id,
      status: stream.status,
      wrapUpSummary: stream.wrapUpSummary,
    };
  }

  const now = new Date();
  const actualDurationSeconds = stream.startedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(stream.startedAt).getTime()) / 1000))
    : 0;

  // Format air time e.g., "14m 32s"
  const minutes = Math.floor(actualDurationSeconds / 60);
  const seconds = actualDurationSeconds % 60;
  const airTimeFormatted = `${minutes}m ${seconds}s`;

  // Read Redis Viewers
  const viewersKey = LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId);
  const liveViewersCount = await RedisService.sCard(viewersKey);
  const finalPeak = Math.max(stream.peakViewers, liveViewersCount);

  // Compute Wrap-Up Summary
  const winnerUser = stream.winner as any;
  const gift = stream.giftItem as any;

  const wrapUpSummary = {
    airTimeFormatted,
    totalLiveClaims: stream.totalClaimsReceived || 0,
    peakViewerCount: finalPeak,
    totalReachCount: stream.totalReach || finalPeak,
    winnerName: winnerUser ? winnerUser.fullName : 'None Selected',
    giftTitle: gift ? gift.title : 'Gift Item',
  };

  // Update Stream State
  stream.status = options?.byAdmin
    ? LIVE_STREAM_STATUS.TERMINATED_BY_ADMIN
    : LIVE_STREAM_STATUS.ENDED;
  stream.endedAt = now;
  stream.actualDurationSeconds = actualDurationSeconds;
  stream.peakViewers = finalPeak;
  stream.totalUniqueViewers = Math.max(stream.totalUniqueViewers, finalPeak);
  stream.wrapUpSummary = wrapUpSummary;

  if (options?.byAdmin) {
    stream.terminatedBy = new Types.ObjectId(options.adminId);
    stream.terminationReason = options.reason || 'Terminated by admin moderation';

    // If stream was force terminated and no winner was awarded, revert gift status
    if (!stream.winner && stream.giftItem) {
      await GiftItem.findByIdAndUpdate(stream.giftItem, {
        claimState: GIFT_CLAIM_STATE.AVAILABLE,
        associatedStream: null,
      });
    }
  }

  await stream.save();

  // Flush Redis Ephemeral Keys
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.STREAM_STATE(streamId));
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId));
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.ACTIVE_LIST);
  await RedisService.del(LIVE_STREAM_REDIS_KEYS.ADMIN_ACTIVE_LIST);

  // Broadcast stream_ended to Room
  safeEmitToRoom(`stream:${streamId}`, 'stream_ended', {
    streamId,
    reason: options?.byAdmin ? 'admin_terminated' : 'host_ended',
    wrapUpSummary,
  });

  return {
    streamId: stream._id,
    status: stream.status,
    wrapUpSummary,
  };
};

/**
 * 6. Get Stream Wrap-Up Summary
 */
const getWrapUpSummary = async (streamId: string) => {
  const stream = await LiveStream.findById(streamId)
    .populate('winner', 'fullName profileImage')
    .populate('giftItem', 'title images coverImageIndex');

  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream session not found');
  }

  const gift = stream.giftItem as any;
  const coverImg =
    gift?.images?.[gift?.coverImageIndex || 0] || gift?.images?.[0] || '';

  return {
    streamId: stream._id,
    channelName: stream.channelName,
    status: stream.status,
    airTimeFormatted: stream.wrapUpSummary?.airTimeFormatted || '0m 0s',
    peakViewerCount: stream.wrapUpSummary?.peakViewerCount || stream.peakViewers,
    totalReachCount: stream.wrapUpSummary?.totalReachCount || stream.totalReach,
    totalLiveClaims: stream.wrapUpSummary?.totalLiveClaims || stream.totalClaimsReceived,
    winner: stream.winner || null,
    giftItem: gift
      ? {
          _id: gift._id,
          title: gift.title,
          coverImage: coverImg,
        }
      : null,
  };
};

/**
 * 7. Handle ZEGOCLOUD Webhooks
 */
const handleZegoWebhook = async (
  body: any,
  headers: Record<string, any>,
) => {
  const signature =
    (headers['x-zego-signature'] as string) ||
    body?.signature ||
    '';
  const timestamp = headers['x-zego-timestamp'] || body?.timestamp || '';
  const nonce = headers['x-zego-nonce'] || body?.nonce || '';

  // Validate Signature
  const isValid = verifyZegoWebhookSignature({
    signature,
    timestamp,
    nonce,
  });

  if (!isValid && process.env.NODE_ENV === 'production') {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid ZEGOCLOUD webhook signature');
  }

  const event = body?.event;
  const roomId = body?.room_id;

  if (event === 'room_close' || event === 'stream_close') {
    if (roomId) {
      const stream = await LiveStream.findOne({ roomId });
      if (stream && stream.status === LIVE_STREAM_STATUS.LIVE) {
        await endBroadcast(stream.host.toString(), stream._id.toString());
      }
    }
  }

  return { received: true };
};

export const LiveStreamService = {
  preLiveInit,
  startBroadcast,
  joinLiveStream,
  getActiveStreams,
  endBroadcast,
  getWrapUpSummary,
  handleZegoWebhook,
};
