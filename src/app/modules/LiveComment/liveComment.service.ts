import { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { RedisService } from '../../redis';
import { getIO } from '../../../socket';
import { User } from '../user/user.models';
import { LiveStream } from '../LiveStream/liveStream.model';
import { LIVE_STREAM_STATUS } from '../LiveStream/liveStream.constants';
import { GiftItem } from '../GiftItem/giftItem.model';
import { LiveStoryClaim } from '../StoryClaim/storyClaim.model';
import { LiveComment, ModerationFlag } from './liveComment.model';
import {
  LIVE_COMMENT_REDIS_KEYS,
  LIVE_COMMENT_SEARCHABLE_FIELDS,
  TARGET_COLLECTION_MAP,
  TFlagTargetType,
  TFlagReasonCode,
  TCommentType,
} from './liveComment.constants';
import QueryBuilder from '../../builder/QueryBuilder';

const safeEmitToRoom = (room: string, event: string, payload: any) => {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch {
    // In testing or disconnected environments
  }
};

/**
 * 1. Send Live Comment
 * Real-time chat comment or emoji reaction during broadcast.
 * Protected by Redis in-memory rate limiting (max 5 comments per 10 seconds).
 */
const sendLiveComment = async (
  userId: string,
  payload: {
    streamId: string;
    message: string;
    commentType?: string;
  },
) => {
  const user = await User.findById(userId);
  if (!user || user.isBlocked || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User account is not active');
  }

  if (user.isSuspended && user.suspendedUntil && user.suspendedUntil > new Date()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account is suspended until ${user.suspendedUntil.toISOString()}`,
    );
  }

  // 1. Verify Stream Status
  const stream = await LiveStream.findById(payload.streamId);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream broadcast not found');
  }

  if (stream.status !== LIVE_STREAM_STATUS.LIVE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Comments can only be posted while the stream broadcast is live',
    );
  }

  // 2. Redis Rate Limiter (Max 5 comments / 10s per user)
  const rateLimitKey = LIVE_COMMENT_REDIS_KEYS.RATE_LIMIT(userId);
  const currentCount = await RedisService.get<number>(rateLimitKey);

  if (currentCount !== null && Number(currentCount) >= 5) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      'You are commenting too fast. Please wait a few seconds before posting again.',
    );
  }

  if (currentCount !== null) {
    await RedisService.set(
      rateLimitKey,
      Number(currentCount) + 1,
      LIVE_COMMENT_REDIS_KEYS.TTL,
    );
  } else {
    await RedisService.set(rateLimitKey, 1, LIVE_COMMENT_REDIS_KEYS.TTL);
  }

  // 3. Create LiveComment Record
  const comment = await LiveComment.create({
    stream: payload.streamId,
    user: userId,
    message: payload.message.trim(),
    commentType: (payload.commentType as TCommentType) || 'text',
  });

  const populatedComment = await LiveComment.findById(comment._id).populate(
    'user',
    'fullName profileImage neighborhoodLabel',
  );

  // 4. Real-time Broadcast via Socket.IO (<50ms delivery)
  safeEmitToRoom(`stream:${payload.streamId}`, 'new_live_comment', {
    comment: populatedComment,
  });

  return populatedComment;
};

/**
 * 2. Get Live Comments for Stream
 */
const getStreamComments = async (
  streamId: string,
  query: Record<string, any>,
) => {
  const baseQuery = LiveComment.find({
    stream: streamId,
    isDeletedByMod: false,
  }).populate('user', 'fullName profileImage neighborhoodLabel');

  const commentQueryBuilder = new QueryBuilder(baseQuery, query)
    .search(LIVE_COMMENT_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await commentQueryBuilder.countTotal();
  const data = await commentQueryBuilder.modelQuery;

  return { meta, data };
};

/**
 * 3. Pin Comment to Live Stream Chat Overlay
 * Host or Admin can pin a prominent comment.
 */
const pinComment = async (
  userId: string,
  commentId: string,
  userRole: string,
) => {
  const comment = await LiveComment.findById(commentId).populate(
    'user',
    'fullName profileImage neighborhoodLabel',
  );
  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live comment not found');
  }

  const stream = await LiveStream.findById(comment.stream);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream not found');
  }

  const isHost = stream.host.toString() === userId;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (!isHost && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the stream host or an administrator can pin comments',
    );
  }

  // Unpin any previously pinned comment on this stream
  await LiveComment.updateMany(
    { stream: stream._id, isPinned: true },
    { $set: { isPinned: false, pinnedAt: null, pinnedBy: null } },
  );

  comment.isPinned = true;
  comment.pinnedAt = new Date();
  comment.pinnedBy = new Types.ObjectId(userId);
  await comment.save();

  // Broadcast pin event
  safeEmitToRoom(`stream:${stream._id.toString()}`, 'comment_pinned', {
    streamId: stream._id,
    comment,
  });

  return comment;
};

/**
 * 4. Unpin Comment from Live Stream
 */
const unpinComment = async (
  userId: string,
  commentId: string,
  userRole: string,
) => {
  const comment = await LiveComment.findById(commentId);
  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live comment not found');
  }

  const stream = await LiveStream.findById(comment.stream);
  if (!stream || stream.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream not found');
  }

  const isHost = stream.host.toString() === userId;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (!isHost && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the stream host or an administrator can unpin comments',
    );
  }

  comment.isPinned = false;
  comment.pinnedAt = null;
  comment.pinnedBy = null;
  await comment.save();

  // Broadcast unpin event
  safeEmitToRoom(`stream:${stream._id.toString()}`, 'comment_unpinned', {
    streamId: stream._id,
    commentId: comment._id,
  });

  return { success: true, message: 'Comment unpinned successfully' };
};

/**
 * 5. Moderation Delete Comment
 * Remotely hides an abusive comment from stream viewers.
 */
const deleteCommentByMod = async (
  userId: string,
  commentId: string,
  userRole: string,
) => {
  const comment = await LiveComment.findById(commentId);
  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live comment not found');
  }

  const stream = await LiveStream.findById(comment.stream);
  if (!stream) {
    throw new AppError(httpStatus.NOT_FOUND, 'Live stream not found');
  }

  const isHost = stream.host.toString() === userId;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (!isHost && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the stream host or an administrator can remove comments',
    );
  }

  comment.isDeletedByMod = true;
  comment.deletedByModAt = new Date();
  comment.deletedByModUser = new Types.ObjectId(userId);
  await comment.save();

  safeEmitToRoom(`stream:${stream._id.toString()}`, 'comment_deleted', {
    streamId: stream._id,
    commentId: comment._id,
  });

  return { success: true, message: 'Comment removed by moderation' };
};

/**
 * 6. Create Moderation Flag / Report
 * Allows users to report inappropriate live comments, story claims,
 * gift items, users, or streams.
 */
const createModerationReport = async (
  userId: string,
  payload: {
    targetType: TFlagTargetType;
    targetId: string;
    reasonCode: TFlagReasonCode;
    reasonText?: string;
  },
) => {
  // 1. Prevent reporting oneself
  if (payload.targetType === 'user' && payload.targetId === userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot report your own account');
  }

  // 2. Verify target existence in DB
  const targetRef = TARGET_COLLECTION_MAP[payload.targetType];
  let targetExists = false;

  switch (payload.targetType) {
    case 'live_comment':
      targetExists = !!(await LiveComment.findById(payload.targetId));
      break;
    case 'story_claim':
      targetExists = !!(await LiveStoryClaim.findById(payload.targetId));
      break;
    case 'gift_item':
      targetExists = !!(await GiftItem.findById(payload.targetId));
      break;
    case 'user':
      targetExists = !!(await User.findById(payload.targetId));
      break;
    case 'live_stream':
      targetExists = !!(await LiveStream.findById(payload.targetId));
      break;
  }

  if (!targetExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `Reported target of type '${payload.targetType}' was not found`,
    );
  }

  // 3. Prevent duplicate report from same user on same target
  const existingReport = await ModerationFlag.findOne({
    reporter: userId,
    targetType: payload.targetType,
    targetId: payload.targetId,
  });

  if (existingReport) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already submitted a report for this content',
    );
  }

  // 4. Create Moderation Flag
  const report = await ModerationFlag.create({
    reporter: userId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    targetRef,
    reasonCode: payload.reasonCode,
    reasonText: payload.reasonText || '',
  });

  return report;
};

export const LiveCommentService = {
  sendLiveComment,
  getStreamComments,
  pinComment,
  unpinComment,
  deleteCommentByMod,
  createModerationReport,
};
