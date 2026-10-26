import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { LiveStreamService } from './liveStream.service';

const preLiveInit = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await LiveStreamService.preLiveInit(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Live studio session initialized successfully',
    data: result,
  });
});

const startBroadcast = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const streamId = req.params.id as string;
  const result = await LiveStreamService.startBroadcast(userId, streamId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Broadcast is officially live!',
    data: result,
  });
});

const joinLiveStream = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId || null;
  const streamId = req.params.id as string;
  const result = await LiveStreamService.joinLiveStream(userId, streamId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Joined live stream session',
    data: result,
  });
});

const getActiveStreams = catchAsync(async (req: Request, res: Response) => {
  const result = await LiveStreamService.getActiveStreams(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Active live streams retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const endBroadcast = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const streamId = req.params.id as string;
  const result = await LiveStreamService.endBroadcast(userId, streamId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Broadcast ended successfully',
    data: result,
  });
});

const getWrapUpSummary = catchAsync(async (req: Request, res: Response) => {
  const streamId = req.params.id as string;
  const result = await LiveStreamService.getWrapUpSummary(streamId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Stream wrap-up stats retrieved successfully',
    data: result,
  });
});

const handleZegoWebhook = catchAsync(async (req: Request, res: Response) => {
  const result = await LiveStreamService.handleZegoWebhook(req.body, req.headers);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ZEGOCLOUD webhook handled',
    data: result,
  });
});

export const LiveStreamController = {
  preLiveInit,
  startBroadcast,
  joinLiveStream,
  getActiveStreams,
  endBroadcast,
  getWrapUpSummary,
  handleZegoWebhook,
};
