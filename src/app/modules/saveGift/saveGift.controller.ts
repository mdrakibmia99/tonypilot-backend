import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SaveGiftService } from './saveGift.service';

const addGiftToSave = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const giftItemId = (req.body.giftItemId || req.body.saveGiftItem) as string;

  const result = await SaveGiftService.addGiftToSave(userId, giftItemId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      isAlreadySaved: result.isAlreadySaved,
      savedGifts: result.data,
    },
  });
});

const getMySavedGifts = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await SaveGiftService.getMySavedGifts(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saved gift items retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const removeSavedGift = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const giftItemId = req.params.giftItemId as string;

  const result = await SaveGiftService.removeSavedGift(userId, giftItemId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift item removed from saved list',
    data: result,
  });
});

const checkIsGiftSaved = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const giftItemId = req.params.giftItemId as string;

  const result = await SaveGiftService.checkIsGiftSaved(userId, giftItemId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saved status checked successfully',
    data: result,
  });
});

export const SaveGiftController = {
  addGiftToSave,
  getMySavedGifts,
  removeSavedGift,
  checkIsGiftSaved,
};
