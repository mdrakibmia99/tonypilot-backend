import mongoose, { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { RedisService } from '../../redis';
import { getIO } from '../../../socket';
import { User } from '../user/user.models';
import { LiveStream } from '../LiveStream/liveStream.model';
import { LIVE_STREAM_STATUS } from '../LiveStream/liveStream.constants';
import { GiftItem } from '../GiftItem/giftItem.model';
import {
  GIFT_CLAIM_STATE,
  GIFT_VERIFICATION_STATUS,
} from '../GiftItem/giftItem.constants';
import { TIER_LIMITS } from '../Subscription/subscription.constants';
import { AdminAuditLog } from '../AuditLog/auditLog.model';
import { LiveStoryClaim } from './storyClaim.model';
import {
  STORY_CLAIM_STATUS,
  ADMIN_REVIEW_STATUS,
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
 * Stories open as soon as an approved gift is published. A stream is linked later
 * during live preparation.
 */
const submitStoryClaim = async (
  userId: string,
  payload: {
    giftItemId: string;
    storyTitle: string;
    storyStatement: string;
  },
  file?: Express.Multer.File,
) => {
  const user = await User.findById(userId);
  if (!user || user.isBlocked || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User account is not active');
  }

  const giftItem = await GiftItem.findById(payload.giftItemId);
  if (!giftItem || giftItem.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  if (
    !giftItem.isPublished ||
    giftItem.verificationStatus !== GIFT_VERIFICATION_STATUS.APPROVED ||
    giftItem.claimState !== GIFT_CLAIM_STATE.AVAILABLE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Stories are not open for this gift item',
    );
  }

  if (giftItem.host.toString() === userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Hosts cannot submit story claims for their own gift',
    );
  }

  const existingClaim = await LiveStoryClaim.findOne({
    applicant: userId,
    giftItem: payload.giftItemId,
    isDeleted: false,
  });
  if (existingClaim) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already submitted a story for this gift',
    );
  }

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

  const streamId = giftItem.associatedStream || null;
  const storyMediaUrl = file?.path
    ? file.path.replace(/\\/g, '/').replace(/^public\//, '/')
    : '';
  const claim = await LiveStoryClaim.create({
    applicant: userId,
    stream: streamId,
    giftItem: giftItem._id,
    storyTitle: payload.storyTitle.trim(),
    storyStatement: payload.storyStatement.trim(),
    storyMediaUrl,
    status: STORY_CLAIM_STATUS.PENDING,
  });

  if (streamId) {
    await LiveStream.findByIdAndUpdate(streamId, {
      $inc: { totalClaimsReceived: 1 },
    });
    await RedisService.del(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(streamId.toString()),
    );
  }
  await GiftItem.findByIdAndUpdate(giftItem._id, {
    $inc: { storyClaimCount: 1 },
  });
  await User.findByIdAndUpdate(userId, {
    $inc: { totalStoriesClaimed: 1 },
  });
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(payload.giftItemId),
  );

  const populatedClaim = await LiveStoryClaim.findById(claim._id).populate(
    'applicant',
    'fullName profileImage neighborhoodLabel communityTrustScore',
  );

  safeEmitToRoom(`user:${giftItem.host.toString()}`, 'new_story_claim', {
    giftItemId: giftItem._id,
    streamId,
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
 * Get all stories for a gift before or during its live broadcast.
 */
const getClaimsForGift = async (
  giftItemId: string,
  query: Record<string, any>,
) => {
  const giftItem = await GiftItem.findById(giftItemId);
  if (!giftItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  const isDefaultQuery =
    !query.searchTerm &&
    (!query.page || query.page === '1') &&
    !query.status;

  if (isDefaultQuery) {
    const cachedData = await RedisService.get(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(giftItemId),
    );
    if (cachedData) {
      try {
        return typeof cachedData === 'string'
          ? JSON.parse(cachedData)
          : cachedData;
      } catch {
        // Fallback to database
      }
    }
  }

  const baseQuery = LiveStoryClaim.find({
    giftItem: giftItemId,
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
      STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(giftItemId),
      JSON.stringify(result),
      STORY_CLAIM_REDIS_KEYS.TTL,
    );
  }

  return result;
};

/**
 * 3. Community Vote on Story Claim ("Community Story Voting")
 * A user has one vote per gift and may switch its type on the same story.
 */
const voteStoryClaim = async (
  userId: string,
  giftItemId: string,
  claimId: string,
  voteType: TVoteType,
) => {
  const claim = await LiveStoryClaim.findOne({
    _id: claimId,
    giftItem: giftItemId,
  });
  if (!claim || claim.isDeleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Story claim was not found for this gift',
    );
  }

  if (claim.applicant.toString() === userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot vote on your own story claim',
    );
  }

  const giftItem = await GiftItem.findById(giftItemId);
  if (
    !giftItem ||
    !giftItem.isPublished ||
    giftItem.verificationStatus !== GIFT_VERIFICATION_STATUS.APPROVED ||
    giftItem.claimState !== GIFT_CLAIM_STATE.AVAILABLE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Voting is closed for this gift item',
    );
  }

  const voterObjectId = new Types.ObjectId(userId);
  const existingGiftVote = await LiveStoryClaim.findOne({
    giftItem: giftItemId,
    voterIds: userId,
    isDeleted: false,
  });

  let updatedClaim = claim;

  if (existingGiftVote) {
    if (existingGiftVote._id.toString() !== claimId) {
      throw new AppError(
        httpStatus.CONFLICT,
        'You have already voted for another story on this gift',
      );
    }

    const existingVote = existingGiftVote.votes?.find(
      (vote) => vote.voter.toString() === userId,
    );
    if (!existingVote) {
      throw new AppError(httpStatus.CONFLICT, 'Your existing vote is invalid');
    }

    if (existingVote.voteType !== voteType) {
      const newCounter = voteType === 'upvote' ? 'upvotes' : 'downvotes';
      const oldCounter =
        existingVote.voteType === 'upvote' ? 'upvotes' : 'downvotes';

      const switchedClaim = await LiveStoryClaim.findOneAndUpdate(
        {
          _id: claimId,
          votes: {
            $elemMatch: {
              voter: voterObjectId,
              voteType: existingVote.voteType,
            },
          },
        },
        {
          $set: { 'votes.$.voteType': voteType },
          $inc: { [newCounter]: 1, [oldCounter]: -1 },
        },
        { new: true, runValidators: true },
      );

      if (!switchedClaim) {
        throw new AppError(
          httpStatus.CONFLICT,
          'Vote changed before the update could be completed',
        );
      }
      updatedClaim = switchedClaim;
    } else {
      updatedClaim = existingGiftVote;
    }
  } else {
    const counterField = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    const newClaimVote = await LiveStoryClaim.findOneAndUpdate(
      {
        _id: claimId,
        giftItem: giftItemId,
        voterIds: { $ne: userId },
      },
      {
        $addToSet: { voterIds: voterObjectId },
        $push: {
          votes: {
            voter: voterObjectId,
            voteType,
          },
        },
        $inc: { [counterField]: 1 },
      },
      { new: true, runValidators: true },
    );

    if (!newClaimVote) {
      throw new AppError(
        httpStatus.CONFLICT,
        'You have already voted for this story',
      );
    }
    updatedClaim = newClaimVote;
  }

  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(giftItemId),
  );

  if (updatedClaim.stream) {
    await RedisService.del(
      STORY_CLAIM_REDIS_KEYS.CLAIMS_STREAM(updatedClaim.stream.toString()),
    );
    safeEmitToRoom(
      `stream:${updatedClaim.stream.toString()}`,
      'claim_vote_updated',
      {
        claimId: updatedClaim._id,
        upvotes: updatedClaim.upvotes,
        downvotes: updatedClaim.downvotes,
      },
    );
  }

  safeEmitToRoom(`gift:${giftItemId}`, 'claim_vote_updated', {
    claimId: updatedClaim._id,
    upvotes: updatedClaim.upvotes,
    downvotes: updatedClaim.downvotes,
  });

  return {
    giftItemId,
    claimId: updatedClaim._id,
    upvotes: updatedClaim.upvotes,
    downvotes: updatedClaim.downvotes,
    userVote: voteType,
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
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(claim.giftItem.toString()),
  );

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
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(claim.giftItem.toString()),
  );

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
      { $inc: { totalGiftsGiven: 1, giftGiven: 1 } },
      { session },
    );
    await User.findByIdAndUpdate(
      claim.applicant,
      { $inc: { totalGiftsReceived: 1, giftReceived: 1 } },
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
  await RedisService.del(
    STORY_CLAIM_REDIS_KEYS.CLAIMS_GIFT(awardedGift._id.toString()),
  );
  await RedisService.del('gifts:featured');
  await RedisService.delByPattern('gifts:public:page:*');

  // Fetch populated winner details for response and real-time celebration
  const winnerUser = await User.findById(awardedClaim.applicant).select(
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

/**
 * Get all stories created by the user (applicant) with pagination
 */
const getMyStoryClaims = async (
  userId: string,
  query: Record<string, any>,
) => {
  const baseQuery = LiveStoryClaim.find({
    applicant: new Types.ObjectId(userId),
    isDeleted: false,
  })
    .populate({
      path: 'giftItem',
      populate: {
        path: 'host',
        select: 'fullName profileImage neighborhoodLabel communityTrustScore',
      },
    })
    .populate('stream')
    .populate(
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

  return { meta, data };
};

/**
 * Get public story claims sorted by highest votes (upvotes) with pagination
 */
const getPublicStoryClaims = async (query: Record<string, any>) => {
  const filterConditions: Record<string, any> = {
    isDeleted: false,
    adminReviewStatus: { $ne: ADMIN_REVIEW_STATUS.REMOVED },
  };

  const queryCopy = { ...query };

  if (queryCopy.minUpvotes !== undefined) {
    filterConditions.upvotes = { $gte: Number(queryCopy.minUpvotes) };
    delete queryCopy.minUpvotes;
  }

  if (queryCopy.giftItemId) {
    filterConditions.giftItem = queryCopy.giftItemId;
    delete queryCopy.giftItemId;
  }

  if (queryCopy.streamId) {
    filterConditions.stream = queryCopy.streamId;
    delete queryCopy.streamId;
  }

  // Default sort by most upvotes first, then newest
  const modifiedQuery = {
    sort: '-upvotes -createdAt',
    ...queryCopy,
  };

  const baseQuery = LiveStoryClaim.find(filterConditions)
    .populate({
      path: 'giftItem',
      populate: {
        path: 'host',
        select: 'fullName profileImage neighborhoodLabel communityTrustScore',
      },
    })
    .populate('stream')
    .populate(
      'applicant',
      'fullName profileImage neighborhoodLabel communityTrustScore',
    );

  const claimQueryBuilder = new QueryBuilder(baseQuery, modifiedQuery)
    .search(STORY_CLAIM_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await claimQueryBuilder.countTotal();
  const data = await claimQueryBuilder.modelQuery;

  return { meta, data };
};

export const StoryClaimService = {
  submitStoryClaim,
  getClaimsForStream,
  getClaimsForGift,
  voteStoryClaim,
  pinStoryClaim,
  unpinStoryClaim,
  awardGiftLive,
  getPickupInstructions,
  getMyStoryClaims,
  getPublicStoryClaims,
};
