import { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { GiftItem } from '../GiftItem/giftItem.model';
import { SaveGift } from './saveGift.model';

/**
 * 1. Add gift item to user's saved list
 * If already saved, notifies user; otherwise adds to saved list.
 */
const addGiftToSave = async (userId: string, giftItemId: string) => {
  // Check if gift item exists and is not deleted
  const giftItem = await GiftItem.findById(giftItemId);
  if (!giftItem || giftItem.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  // Find existing SaveGift document for the user
  let savedGiftRecord = await SaveGift.findOne({
    userId: new Types.ObjectId(userId),
  });

  if (!savedGiftRecord) {
    savedGiftRecord = await SaveGift.create({
      userId: new Types.ObjectId(userId),
      saveGiftItem: [new Types.ObjectId(giftItemId)],
    });

    const populatedRecord = await SaveGift.findById(savedGiftRecord._id).populate({
      path: 'saveGiftItem',
      populate: {
        path: 'host',
        select: 'fullName profileImage neighborhoodLabel communityTrustScore',
      },
    });

    return {
      isAlreadySaved: false,
      message: 'Gift item saved successfully',
      data: populatedRecord,
    };
  }

  // Check if the gift item is already in saveGiftItem
  const isAlreadySaved = savedGiftRecord.saveGiftItem.some(
    (id) => id.toString() === giftItemId.toString(),
  );

  if (isAlreadySaved) {
    const populatedRecord = await SaveGift.findById(savedGiftRecord._id).populate({
      path: 'saveGiftItem',
      populate: {
        path: 'host',
        select: 'fullName profileImage neighborhoodLabel communityTrustScore',
      },
    });

    return {
      isAlreadySaved: true,
      message: 'Gift item is already saved',
      data: populatedRecord,
    };
  }

  // Add the gift item ID
  savedGiftRecord.saveGiftItem.push(new Types.ObjectId(giftItemId));
  await savedGiftRecord.save();

  const populatedRecord = await SaveGift.findById(savedGiftRecord._id).populate({
    path: 'saveGiftItem',
    populate: {
      path: 'host',
      select: 'fullName profileImage neighborhoodLabel communityTrustScore',
    },
  });

  return {
    isAlreadySaved: false,
    message: 'Gift item saved successfully',
    data: populatedRecord,
  };
};

/**
 * 2. Get all saved gifts for the logged-in user with pagination
 */
const getMySavedGifts = async (
  userId: string,
  query: Record<string, any>,
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const savedGiftRecord = await SaveGift.findOne({
    userId: new Types.ObjectId(userId),
  }).populate({
    path: 'saveGiftItem',
    match: { isDeleted: false },
    populate: {
      path: 'host',
      select: 'fullName profileImage neighborhoodLabel communityTrustScore',
    },
  });

  if (!savedGiftRecord || !savedGiftRecord.saveGiftItem) {
    return {
      meta: {
        page,
        limit,
        total: 0,
        totalPage: 0,
      },
      data: [],
    };
  }

  const allItems = savedGiftRecord.saveGiftItem;
  const total = allItems.length;
  const totalPage = Math.ceil(total / limit);
  const paginatedData = allItems.slice(skip, skip + limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: paginatedData,
  };
};

/**
 * 3. Remove gift item from user's saved list
 */
const removeSavedGift = async (userId: string, giftItemId: string) => {
  const updatedRecord = await SaveGift.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $pull: { saveGiftItem: new Types.ObjectId(giftItemId) } },
    { new: true },
  ).populate({
    path: 'saveGiftItem',
    populate: {
      path: 'host',
      select: 'fullName profileImage neighborhoodLabel communityTrustScore',
    },
  });

  if (!updatedRecord) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saved gifts record not found');
  }

  return updatedRecord;
};

/**
 * 4. Check if a gift item is saved by user
 */
const checkIsGiftSaved = async (userId: string, giftItemId: string) => {
  const record = await SaveGift.findOne({
    userId: new Types.ObjectId(userId),
    saveGiftItem: new Types.ObjectId(giftItemId),
  });

  return {
    isSaved: !!record,
  };
};

export const SaveGiftService = {
  addGiftToSave,
  getMySavedGifts,
  removeSavedGift,
  checkIsGiftSaved,
};
