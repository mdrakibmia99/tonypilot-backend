import mongoose, { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { RedisService } from '../../redis';
import { getIO } from '../../../socket';
import { User } from '../user/user.models';
import { LiveStream } from '../LiveStream/liveStream.model';
import { LIVE_STREAM_STATUS } from '../LiveStream/liveStream.constants';
import { GiftItem } from '../GiftItem/giftItem.model';
import { GIFT_CLAIM_STATE } from '../GiftItem/giftItem.constants';
import { TIER_LIMITS } from '../Subscription/subscription.constants';
import { AdminAuditLog } from '../AuditLog/auditLog.model';
import { LiveStoryClaim } from './storyClaim.model';
import {
  STORY_CLAIM_STATUS,
  STORY_CLAIM_REDIS_KEYS,
  STORY_CLAIM_SEARCHABLE_FIELDS,
  TVoteType,
} from './storyClaim.constants';
import QueryBuilder from '../../builder/QueryBuilder';

const safeEmitToRoom = (room: string, event: string, payload: any) => {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch {
    // Socket server may not be active in test environments
  }
};

/**
 * 1. Submit Story Claim ("Request with Story")
 * Applicant submits why they need the gift item.
 * Enforces daily subscription limits, live status, and host-claim prevention.
 */
const submitStoryClaim = async (
  userId: string,
  payload: { streamId: string; storyStatement: string },
  file?: Express.Multer.File,
) => {
  const user = await User.findById(userId);
  if (!user || user.isBlocked || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User account is not active');
  }

  // 1. Verify LiveStream status
  const stream = await LiveStream.findById(payload.streamId);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Stories can only be submitted while the broadcast is actively live',
    );
  }

  // 2. Prevent Host from claiming their own gift
  if (stream.host.toString() === userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Hosts cannot submit story claims for their own stream gift',
    );
  }

  // 3. Enforce Uniqueness: One claim per applicant per stream
  const existingClaim = await LiveStoryClaim.findOne({
    applicant: userId,
    stream: payload.streamId,
    isDeleted: false,
  });
  if (existingClaim) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already submitted a story claim for this live broadcast',
    );
  }

  // 4. Enforce Daily Story Claim Subscription Quota
  const tier = (user.subscriptionTier || 'free') as keyof typeof TIER_LIMITS;
  const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const claimsToday = await LiveStoryClaim.countDocuments({
    applicant: userId,
    createdAt: { $gte: startOfDay },
  });

  if (
    tierLimits.maxStoryClaimsPerDay !== -1 &&
    claimsToday >= tierLimits.maxStoryClaimsPerDay
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Daily story claim limit (${tierLimits.maxStoryClaimsPerDay}) reached for ${tier} tier. Upgrade your subscription to apply for more gifts.`,
    );
  }

  // 5. Handle optional attachment
  let storyMediaUrl = '';
  if (file) {
    storyMediaUrl = `/uploads/${file.filename}`;
  }

  // 6. Create Story Claim Document
  const claim = await LiveStoryClaim.create({
    applicant: userId,
    stream: payload.streamId,
    giftItem: stream.giftItem,
    storyStatement: payload.storyStatement.trim(),
    storyMediaUrl,
    status: STORY_CLAIM_STATUS.PENDING,
  });

  // 7. Increment Counters
  await LiveStream.findByIdAndUpdate(payload.streamId, {
    $inc: { totalClaimsReceived: 1 },
  });
  await GiftItem.findByIdAndUpdate(stream.giftItem, {
    $inc: { storyClaimCount: 1 },
  });
  await User.findByIdAndUpdate(userId, {
    $inc: { totalStoriesClaimed: 1 },
  });

  // Invalidate Claims Cache for Stream
  await RedisService.del(STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(payload.streamId));

  // 8. Real-time Notification to Host
  const populatedClaim = await LiveStoryClaim.findById(claim._id).populate(
    'applicant',
    'fullName profileImage neighborhoodLabel communityTrustScore',
  );

  safeEmitToRoom(`user:${stream.host.toString()}`, 'new_story_claim', {
    streamId: payload.streamId,
    claim: populatedClaim,
  });

  return populatedClaim;
};

/**
 * 2. Get Story Claims for Live Stream ("Live Story Claims" Bottom Sheet)
 * Cache-aside with 15s TTL via Redis.
 */
const getClaimsForStream = async (
  streamId: string,
  query: Record<string, any>,
) => {
  const isDefaultQuery =
    !query.searchTerm &&
    (!query.page || query.page === '1') &&
    !query.status;

  if (isDefaultQuery) {
    const cachedData = await RedisService.get(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(streamId),
    );
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch {
        // Fallback to database
      }
    }
  }

  const baseQuery = LiveStoryClaim.find({
    stream: streamId,
    isDeleted: false,
  }).populate(
    'applicant',
    'fullName profileImage neighborhoodLabel communityTrustScore',
  );

  const claimQueryBuilder = new QueryBuilder(baseQuery, query)
    .search(STORY_CLAIM_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await claimQueryBuilder.countTotal();
  const data = await claimQueryBuilder.modelQuery;

  const result = { meta, data };

  if (isDefaultQuery) {
    await RedisService.set(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(streamId),
      JSON.stringify(result),
      STORY_CLAIM_REDIS_KEYS.TTL,
    );
  }

  return result;
};

/**
 * 3. Community Vote on Story Claim ("Community Story Voting")
 * Allows viewers to upvote/downvote applicant stories.
 * Enforces toggle and switch behavior with zero duplicate vote drift.
 */
const voteStoryClaim = async (
  userId: string,
  claimId: string,
  voteType: TVoteType,
) => {
  const claim = await LiveStoryClaim.findById(claimId);
  if (!claim || claim.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
  }

  // Prevent applicant from voting on their own story
  if (claim.applicant.toString() === userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot vote on your own story claim',
    );
  }

  // Verify stream is live
  const stream = await LiveStream.findById(claim.stream);
  if (!stream || stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Voting is only active while the broadcast is live',
    );
  }

  const votes = claim.votes || [];
  const existingVoteIndex = votes.findIndex(
    (v) => v.voter.toString() === userId,
  );

  let userVoteState: string | null = voteType;

  if (existingVoteIndex === -1) {
    // 1. New Vote
    votes.push({
      voter: new Types.ObjectId(userId),
      voteType,
    });
    claim.voterIds.push(new Types.ObjectId(userId));

    if (voteType === 'upvote') {
      claim.upvotes += 1;
    } else {
      claim.downvotes += 1;
    }
  } else {
    const existingVote = votes[existingVoteIndex];

    if (existingVote.voteType === voteType) {
      // 2. Toggle Off (remove vote)
      votes.splice(existingVoteIndex, 1);
      claim.voterIds = claim.voterIds.filter(
        (id) => id.toString() !== userId,
      );

      if (voteType === 'upvote') {
        claim.upvotes = Math.max(0, claim.upvotes - 1);
      } else {
        claim.downvotes = Math.max(0, claim.downvotes - 1);
      }
      userVoteState = null;
    } else {
      // 3. Switch Vote (upvote <-> downvote)
      existingVote.voteType = voteType;

      if (voteType === 'upvote') {
        claim.upvotes += 1;
        claim.downvotes = Math.max(0, claim.downvotes - 1);
      } else {
        claim.downvotes += 1;
        claim.upvotes = Math.max(0, claim.upvotes - 1);
      }
    }
  }

  claim.votes = votes;
  await claim.save();

  // Invalidate Redis Stream Claims Cache
  await RedisService.del(STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(claim.stream.toString()));

  // Broadcast Real-time Vote Update
  safeEmitToRoom(`stream:${claim.stream.toString()}`, 'claim_vote_updated', {
    claimId: claim._id,
    upvotes: claim.upvotes,
    downvotes: claim.downvotes,
  });

  return {
    claimId: claim._id,
    upvotes: claim.upvotes,
    downvotes: claim.downvotes,
    userVote: userVoteState,
  };
};

/**
 * 4. Pin Story Claim to Stream ("PINNED APPLICANT STORY")
 * Host expands an applicant's claim and pins it to the live stream broadcast overlay.
 */
const pinStoryClaim = async (userId: string, claimId: string) => {
  const claim = await LiveStoryClaim.findById(claimId).populate(
    'applicant',
    'fullName profileImage neighborhoodLabel communityTrustScore',
  );
  if (!claim || claim.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
  }

  const stream = await LiveStream.findById(claim.stream);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  if (stream.host.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the stream host can pin story claims',
    );
  }

  if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Story claims can only be pinned while broadcast is live',
    );
  }

  // Unpin any currently pinned claim for this stream
  await LiveStoryClaim.updateMany(
    { stream: stream._id, isPinned: true },
    {
      $set: {
        isPinned: false,
        status: STORY_CLAIM_STATUS.PENDING,
        unpinnedAt: new Date(),
      },
    },
  );

  // Pin the requested claim
  claim.isPinned = true;
  claim.status = STORY_CLAIM_STATUS.PINNED;
  claim.pinnedAt = new Date();
  await claim.save();

  // Update LiveStream pinnedClaim reference
  stream.pinnedClaim = claim._id as Types.ObjectId;
  stream.totalClaimsPinned = (stream.totalClaimsPinned || 0) + 1;
  await stream.save();

  // Invalidate Cache
  await RedisService.del(STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(stream._id.toString()));

  // Broadcast Socket.IO event to all viewers in the room
  safeEmitToRoom(`stream:${stream._id.toString()}`, 'story_claim_pinned', {
    streamId: stream._id,
    claim,
  });

  return claim;
};

/**
 * 5. Unpin Story Claim from Stream
 */
const unpinStoryClaim = async (userId: string, claimId: string) => {
  const claim = await LiveStoryClaim.findById(claimId);
  if (!claim || claim.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
  }

  const stream = await LiveStream.findById(claim.stream);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  if (stream.host.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the stream host can unpin story claims',
    );
  }

  claim.isPinned = false;
  claim.status = STORY_CLAIM_STATUS.PENDING;
  claim.unpinnedAt = new Date();
  await claim.save();

  if (stream.pinnedClaim?.toString() === claimId) {
    stream.pinnedClaim = null;
    await stream.save();
  }

  // Invalidate Cache
  await RedisService.del(STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(stream._id.toString()));

  // Broadcast Unpin to all viewers
  safeEmitToRoom(`stream:${stream._id.toString()}`, 'story_claim_unpinned', {
    streamId: stream._id,
    claimId: claim._id,
  });

  return { success: true, message: 'Story claim unpinned successfully' };
};

/**
 * 6. Execute Live Award (THE ACID TRANSACTION)
 * Atomically awards the gift to the selected claim applicant,
 * locks the stream and gift, updates user stats, logs admin audit,
 * and launches celebratory celebration overlay.
 */
const awardGiftLive = async (userId: string, claimId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let awardedClaim: any;
  let awardedStream: any;
  let awardedGift: any;
  let winnerUser: any;

  try {
    // 1. Fetch Claim within Session
    const claim = await LiveStoryClaim.findById(claimId).session(session);
    if (!claim || claim.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
    }

    if (claim.status === STORY_CLAIM_STATUS.AWARDED) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This story claim has already been awarded',
      );
    }

    // 2. Fetch LiveStream with Concurrency Checks
    const stream = await LiveStream.findById(claim.stream).session(session);
    if (!stream || stream.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
    }

    if (stream.host.toString() !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Only the stream host can select and award the gift',
      );
    }

    if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Gift can only be awarded while the broadcast is actively live',
      );
    }

    if (stream.winner) {
      throw new AppError(
        httpStatus.CONFLICT,
        'A winner has already been selected and awarded for this stream broadcast',
      );
    }

    // 3. Fetch GiftItem
    const giftItem = await GiftItem.findById(stream.giftItem).session(session);
    if (!giftItem || giftItem.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
    }

    if (giftItem.claimState !== GIFT_CLAIM_STATE.AVAILABLE) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Gift item is currently in '${giftItem.claimState}' state and cannot be awarded`,
      );
    }

    const now = new Date();

    // 4. Update StoryClaim -> Awarded
    claim.status = STORY_CLAIM_STATUS.AWARDED;
    claim.awardedAt = now;
    claim.isPinned = true;
    claim.pinnedAt = now;
    await claim.save({ session });

    // 5. Reject All Other Claims for this stream
    await LiveStoryClaim.updateMany(
      {
        stream: stream._id,
        _id: { $ne: claim._id },
        status: {
          $in: [STORY_CLAIM_STATUS.PENDING, STORY_CLAIM_STATUS.PINNED],
        },
      },
      {
        $set: {
          status: STORY_CLAIM_STATUS.REJECTED,
          isPinned: false,
        },
      },
      { session },
    );

    // 6. Update LiveStream with Winner & Award Details
    stream.winner = claim.applicant;
    stream.winningClaim = claim._id as Types.ObjectId;
    stream.awardedAt = now;
    stream.pinnedClaim = claim._id as Types.ObjectId;
    await stream.save({ session });

    // 7. Update GiftItem -> Claimed
    giftItem.claimState = GIFT_CLAIM_STATE.CLAIMED;
    giftItem.claimedBy = claim.applicant;
    giftItem.claimedAt = now;
    await giftItem.save({ session });

    // 8. Update Community Statistics
    await User.findByIdAndUpdate(
      userId,
      { $inc: { totalGiftsGiven: 1 } },
      { session },
    );
    await User.findByIdAndUpdate(
      claim.applicant,
      { $inc: { totalGiftsReceived: 1 } },
      { session },
    );

    // 9. Create Audit Log Record
    await AdminAuditLog.create(
      [
        {
          action: 'GIFT_AWARDED_LIVE',
          performedBy: userId,
          performedByRole: 'host',
          targetUser: claim.applicant,
          targetStream: stream._id,
          targetGiftItem: giftItem._id,
          targetClaim: claim._id,
          metadata: {
            roomId: stream.roomId,
            giftTitle: giftItem.title,
            claimId: claim._id.toString(),
            awardedAt: now.toISOString(),
          },
        },
      ],
      { session },
    );

    // Commit MongoDB Transaction
    await session.commitTransaction();

    awardedClaim = claim;
    awardedStream = stream;
    awardedGift = giftItem;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // Cache Invalidation
  await RedisService.del(STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(awardedStream._id.toString()));
  await RedisService.del('gifts:featured');
  await RedisService.delByPattern('gifts:public:page:*');

  // Fetch populated winner details for response and real-time celebration
  winnerUser = await User.findById(awardedClaim.applicant).select(
    'fullName profileImage neighborhoodLabel',
  );

  // 10. Real-time Celebration Event Emitted to Room ("GIFT AWARDED LIVE!")
  safeEmitToRoom(`stream:${awardedStream._id.toString()}`, 'gift_awarded', {
    streamId: awardedStream._id,
    claimId: awardedClaim._id,
    winner: {
      _id: winnerUser?._id,
      fullName: winnerUser?.fullName || 'Winner',
      profileImage: winnerUser?.profileImage || '',
    },
    giftItem: {
      _id: awardedGift._id,
      title: awardedGift.title,
    },
  });

  return {
    streamId: awardedStream._id,
    winner: {
      _id: winnerUser?._id,
      fullName: winnerUser?.fullName || 'Winner',
      profileImage: winnerUser?.profileImage || '',
    },
    giftItem: {
      _id: awardedGift._id,
      title: awardedGift.title,
      claimState: awardedGift.claimState,
    },
    claim: awardedClaim,
  };
};

/**
 * 7. Get Winner Pickup Instructions (Post-Award)
 * Only the awarded winner, stream host, or admin can access.
 */
const getPickupInstructions = async (
  userId: string,
  claimId: string,
  userRole?: string,
) => {
  const claim = await LiveStoryClaim.findById(claimId)
    .populate('stream')
    .populate('giftItem')
    .populate('applicant', 'fullName phone profileImage');

  if (!claim || claim.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Story claim not found');
  }

  const stream = claim.stream as any;
  const gift = claim.giftItem as any;
  const applicant = claim.applicant as any;

  if (claim.status !== STORY_CLAIM_STATUS.AWARDED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Pickup instructions are only available after a claim is officially awarded',
    );
  }

  const isWinner = applicant._id.toString() === userId;
  const isHost = stream.host.toString() === userId;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (!isWinner && !isHost && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to view pickup instructions for this gift',
    );
  }

  const hostUser = await User.findById(stream.host).select('fullName phone');

  return {
    giftTitle: gift.title,
    pickupAddress: gift.pickupAddress?.address || 'Pickup location not specified',
    pickupCoordinates: gift.pickupAddress?.location?.coordinates || null,
    pickupWindowStart: gift.pickupWindowStart || 'Anytime',
    pickupWindowEnd: gift.pickupWindowEnd || 'Anytime',
    pickupInstructions: gift.pickupInstructions || '',
    specialInstructions: gift.specialInstructions || '',
    hostContact: {
      fullName: hostUser?.fullName || 'Stream Host',
      phone: hostUser?.phone?.fullNumber || 'Private contact',
    },
    winnerContact: {
      fullName: applicant.fullName,
      phone: applicant.phone?.fullNumber || 'Private contact',
    },
    pickupConfirmed: claim.pickupConfirmed || false,
    pickupConfirmedAt: claim.pickupConfirmedAt || null,
  };
};

export const StoryClaimService = {
  submitStoryClaim,
  getClaimsForStream,
  voteStoryClaim,
  pinStoryClaim,
  unpinStoryClaim,
  awardGiftLive,
  getPickupInstructions,
};
