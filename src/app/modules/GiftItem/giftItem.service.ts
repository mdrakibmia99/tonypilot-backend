import { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { RedisService } from '../../redis';
import { User } from '../user/user.models';
import { GiftItem } from './giftItem.model';
import { TGiftItem } from './giftItem.interface';
import {
  GIFT_CLAIM_STATE,
  GIFT_SEARCHABLE_FIELDS,
  GIFT_VERIFICATION_STATUS,
} from './giftItem.constants';
import { TIER_LIMITS } from '../Subscription/subscription.constants';
import { USER_ROLE } from '../user/user.constants';

// ==========================================
// 1. CREATE GIFT ITEM (5-STEP MOBILE WIZARD)
// ==========================================
const createGiftItem = async (
  userId: string,
  payload: Partial<TGiftItem>,
  imageFiles: Express.Multer.File[] = []
): Promise<TGiftItem> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Enforce Monthly Subscription Quota
  const userTier = user.subscriptionTier || 'free';
  const limits = TIER_LIMITS[userTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

  if (limits.maxGiftPostsPerMonth !== -1) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const countThisMonth = await GiftItem.countDocuments({
      host: new Types.ObjectId(userId),
      createdAt: { $gte: startOfMonth },
    });

    if (countThisMonth >= limits.maxGiftPostsPerMonth) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Monthly gift post limit (${limits.maxGiftPostsPerMonth}) reached for ${userTier} tier. Please upgrade your subscription to post more items.`
      );
    }
  }

  // Handle uploaded images
  const uploadedImageUrls: string[] = [];
  if (imageFiles && imageFiles.length > 0) {
    for (const file of imageFiles) {
      // Normalize path for web delivery
      const webPath = file.path.replace(/\\/g, '/').replace(/^public\//, '/');
      uploadedImageUrls.push(webPath);
    }
  }

  const finalImages = uploadedImageUrls.length > 0 ? uploadedImageUrls : (payload.images || []);
  if (finalImages.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least 1 photo is required to publish a gift.');
  }

  const newGift = await GiftItem.create({
    ...payload,
    host: new Types.ObjectId(userId),
    images: finalImages,
    coverImageIndex: payload.coverImageIndex || 0,
    claimState: GIFT_CLAIM_STATE.AVAILABLE,
    verificationStatus: GIFT_VERIFICATION_STATUS.APPROVED,
    isPublished: payload.isPublished !== undefined ? payload.isPublished : true,
    publishedAt: new Date(),
    availableFrom: payload.availableFrom || new Date(),
  });

  // Increment user counter
  await User.findByIdAndUpdate(userId, { $inc: { totalGiftsGiven: 1 } });

  // Invalidate discover cache
  await RedisService.del('gifts:featured');
  await RedisService.delByPattern('gifts:public:page:*');

  return newGift;
};

// ==========================================
// 2. DISCOVER FEED (GEO-SPATIAL + CACHED)
// ==========================================
const getPublicAvailableGifts = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const isDefaultQuery =
    !query.searchTerm &&
    !query.category &&
    !query.condition &&
    !query.longitude &&
    !query.latitude &&
    page <= 5;

  const cacheKey = `gifts:public:page:${page}`;
  if (isDefaultQuery) {
    const cached = await RedisService.get(cacheKey);
    if (cached) return cached;
  }

  const cleanQuery = { ...query };
  delete cleanQuery.longitude;
  delete cleanQuery.latitude;
  delete cleanQuery.maxDistanceMeters;

  let baseFilter: Record<string, unknown> = {
    claimState: GIFT_CLAIM_STATE.AVAILABLE,
    verificationStatus: GIFT_VERIFICATION_STATUS.APPROVED,
    isPublished: true,
  };

  // Geo-spatial filtering if coordinates provided
  if (query.longitude !== undefined && query.latitude !== undefined) {
    const lng = Number(query.longitude);
    const lat = Number(query.latitude);
    const maxDist = Number(query.maxDistanceMeters) || 40233; // ~25 miles
    const radians = maxDist / 6378100;

    baseFilter = {
      ...baseFilter,
      'pickupAddress.location': {
        $geoWithin: {
          $centerSphere: [[lng, lat], radians],
        },
      },
    };
  }

  const giftQuery = GiftItem.find(baseFilter).populate(
    'host',
    'fullName profileImage neighborhoodLabel communityTrustScore'
  );

  const queryBuilder = new QueryBuilder(giftQuery, cleanQuery)
    .search(GIFT_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();

  const result = { meta, data };

  if (isDefaultQuery) {
    await RedisService.set(cacheKey, result, 300); // 5 min TTL
  }

  return result;
};

// ==========================================
// 3. GET MY POSTED GIFTS
// ==========================================
const getMyGiftItems = async (userId: string, query: Record<string, unknown>) => {
  const giftQuery = GiftItem.find({ host: new Types.ObjectId(userId) });

  const queryBuilder = new QueryBuilder(giftQuery, query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();

  return { meta, data };
};

// ==========================================
// 4. GET SINGLE GIFT ITEM DETAILS
// ==========================================
const getGiftItemById = async (id: string): Promise<TGiftItem> => {
  const cacheKey = `gift:${id}`;
  const cached = await RedisService.get<TGiftItem>(cacheKey);
  if (cached) {
    // Increment view count asynchronously
    GiftItem.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();
    return cached;
  }

  const gift = await GiftItem.findById(id).populate(
    'host',
    'fullName profileImage neighborhoodLabel communityTrustScore about createdAt'
  );

  if (!gift) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  // Increment view count
  gift.viewCount = (gift.viewCount || 0) + 1;
  await gift.save();

  await RedisService.set(cacheKey, gift, 300);
  return gift;
};

// ==========================================
// 5. UPDATE GIFT ITEM
// ==========================================
const updateGiftItem = async (
  id: string,
  userId: string,
  userRole: string,
  payload: Partial<TGiftItem>,
  newImageFiles: Express.Multer.File[] = []
): Promise<TGiftItem> => {
  const gift = await GiftItem.findById(id);
  if (!gift) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  const isHost = gift.host.toString() === userId;
  const isAdmin = userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.SUPER_ADMIN;

  if (!isHost && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to edit this gift');
  }

  if (gift.claimState === GIFT_CLAIM_STATE.CLAIMED && !isAdmin) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot edit a gift that has already been awarded');
  }

  // If new images provided
  if (newImageFiles && newImageFiles.length > 0) {
    const uploaded = newImageFiles.map(f => f.path.replace(/\\/g, '/').replace(/^public\//, '/'));
    payload.images = [...(payload.images || gift.images), ...uploaded].slice(0, 5);
  }

  const updated = await GiftItem.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!updated) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update gift item');
  }

  // Invalidate caches
  await RedisService.del(`gift:${id}`);
  await RedisService.del('gifts:featured');
  await RedisService.delByPattern('gifts:public:page:*');

  return updated;
};

// ==========================================
// 6. DELETE GIFT ITEM (SOFT DELETE)
// ==========================================
const deleteGiftItem = async (id: string, userId: string, userRole: string): Promise<void> => {
  const gift = await GiftItem.findById(id);
  if (!gift) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  const isHost = gift.host.toString() === userId;
  const isAdmin = userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.SUPER_ADMIN;

  if (!isHost && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to delete this gift');
  }

  if (gift.claimState === GIFT_CLAIM_STATE.CLAIMED && !isAdmin) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot delete an item that is already claimed');
  }

  gift.isDeleted = true;
  await gift.save();

  // Invalidate caches
  await RedisService.del(`gift:${id}`);
  await RedisService.del('gifts:featured');
  await RedisService.delByPattern('gifts:public:page:*');
};

// ==========================================
// 7. ADMIN REVIEW GIFT ITEM
// ==========================================
const reviewGiftItem = async (
  id: string,
  adminId: string,
  action: string,
  notes?: string,
  rejectionReason?: string
) => {
  const gift = await GiftItem.findById(id);
  if (!gift) {
    throw new AppError(httpStatus.NOT_FOUND, 'Gift item not found');
  }

  gift.verificationStatus = action as any;
  gift.adminReviewedBy = new Types.ObjectId(adminId);
  gift.adminReviewedAt = new Date();
  if (notes) gift.adminReviewNotes = notes;
  if (rejectionReason) gift.rejectionReason = rejectionReason;

  await gift.save();

  await RedisService.del(`gift:${id}`);
  await RedisService.delByPattern('gifts:public:page:*');

  return gift;
};

export const GiftItemService = {
  createGiftItem,
  getPublicAvailableGifts,
  getMyGiftItems,
  getGiftItemById,
  updateGiftItem,
  deleteGiftItem,
  reviewGiftItem,
};
