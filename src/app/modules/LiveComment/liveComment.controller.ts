import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { LiveCommentService } from './liveComment.service';

const sendLiveComment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await LiveCommentService.sendLiveComment(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Comment sent successfully',
    data: result,
  });
});

const getStreamComments = catchAsync(async (req: Request, res: Response) => {
  const streamId = req.params.streamId as string;
  const result = await LiveCommentService.getStreamComments(streamId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Stream comments retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const pinComment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const userRole = req.user.role;
  const commentId = req.params.id as string;

  const result = await LiveCommentService.pinComment(
    userId,
    commentId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment pinned to broadcast chat',
    data: result,
  });
});

const unpinComment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const userRole = req.user.role;
  const commentId = req.params.id as string;

  const result = await LiveCommentService.unpinComment(
    userId,
    commentId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment unpinned successfully',
    data: result,
  });
});

const deleteCommentByMod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const userRole = req.user.role;
  const commentId = req.params.id as string;

  const result = await LiveCommentService.deleteCommentByMod(
    userId,
    commentId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment removed by moderation',
    data: result,
  });
});

const createModerationReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await LiveCommentService.createModerationReport(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Report submitted successfully for admin review',
    data: result,
  });
});

export const LiveCommentController = {
  sendLiveComment,
  getStreamComments,
  pinComment,
  unpinComment,
  deleteCommentByMod,
  createModerationReport,
};
