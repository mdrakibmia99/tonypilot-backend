import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { StoryClaimService } from './storyClaim.service';

const submitStoryClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await StoryClaimService.submitStoryClaim(
    userId,
    req.body,
    req.file,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Your story is in the community's hands.",
    data: result,
  });
});

const getClaimsForStream = catchAsync(async (req: Request, res: Response) => {
  const streamId = req.params.streamId as string;
  const result = await StoryClaimService.getClaimsForStream(
    streamId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Story claims retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getClaimsForGift = catchAsync(async (req: Request, res: Response) => {
  const giftItemId = req.params.giftItemId as string;
  const result = await StoryClaimService.getClaimsForGift(
    giftItemId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift stories retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const voteStoryClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const giftItemId = req.params.giftItemId as string;
  const storyClaimId = req.params.storyClaimId as string;
  const { voteType } = req.body;

  const result = await StoryClaimService.voteStoryClaim(
    userId,
    giftItemId,
    storyClaimId,
    voteType,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Vote recorded successfully',
    data: result,
  });
});

const pinStoryClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const claimId = req.params.id as string;

  const result = await StoryClaimService.pinStoryClaim(userId, claimId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Story claim pinned to stream broadcast',
    data: result,
  });
});

const unpinStoryClaim = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const claimId = req.params.id as string;

  const result = await StoryClaimService.unpinStoryClaim(userId, claimId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Story claim unpinned',
    data: result,
  });
});

const awardGiftLive = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const claimId = req.params.id as string;

  const result = await StoryClaimService.awardGiftLive(userId, claimId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift officially awarded to winner!',
    data: result,
  });
});

const getPickupInstructions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const userRole = req.user.role;
  const claimId = req.params.id as string;

  const result = await StoryClaimService.getPickupInstructions(
    userId,
    claimId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pickup instructions retrieved successfully',
    data: result,
  });
});

const getMyStoryClaims = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await StoryClaimService.getMyStoryClaims(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My story claims retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const StoryClaimController = {
  submitStoryClaim,
  getClaimsForStream,
  getClaimsForGift,
  voteStoryClaim,
  pinStoryClaim,
  unpinStoryClaim,
  awardGiftLive,
  getPickupInstructions,
  getMyStoryClaims,
};
