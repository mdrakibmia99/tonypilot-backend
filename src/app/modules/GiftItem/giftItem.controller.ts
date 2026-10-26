import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { GiftItemService } from './giftItem.service';

const createGiftItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const files = (req.files as Express.Multer.File[]) || [];
  const result = await GiftItemService.createGiftItem(userId, req.body, files);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Your gift is officially live! 🎁',
    data: result,
  });
});

const getPublicAvailableGifts = catchAsync(async (req: Request, res: Response) => {
  const result = await GiftItemService.getPublicAvailableGifts(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Available gifts retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getMyGiftItems = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await GiftItemService.getMyGiftItems(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My gift items retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getGiftItemById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await GiftItemService.getGiftItemById(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift details retrieved successfully',
    data: result,
  });
});

const updateGiftItem = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const files = (req.files as Express.Multer.File[]) || [];

  const result = await GiftItemService.updateGiftItem(
    id as string,
    userId,
    userRole,
    req.body,
    files
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift item updated successfully',
    data: result,
  });
});

const deleteGiftItem = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  await GiftItemService.deleteGiftItem(id as string, userId, userRole);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Gift item removed successfully',
    data: null,
  });
});

const reviewGiftItem = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.userId;
  const { action, notes, rejectionReason } = req.body;

  const result = await GiftItemService.reviewGiftItem(
    id as string,
    adminId,
    action,
    notes,
    rejectionReason
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Gift listing ${action} successfully`,
    data: result,
  });
});

export const GiftItemController = {
  createGiftItem,
  getPublicAvailableGifts,
  getMyGiftItems,
  getGiftItemById,
  updateGiftItem,
  deleteGiftItem,
  reviewGiftItem,
};
