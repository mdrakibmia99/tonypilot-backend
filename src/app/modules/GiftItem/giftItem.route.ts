import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { GiftItemController } from './giftItem.controller';
import { GiftItemValidations } from './giftItem.validation';

const upload = fileUpload('./public/uploads/gifts');
const router = Router();

// ==========================================
// 1. PUBLIC DISCOVER FEED
// ==========================================
router.get('/public', GiftItemController.getPublicAvailableGifts);

// ==========================================
// 2. AUTHENTICATED USER GIFT ROUTES
// ==========================================
router.get(
  '/my-items',
  auth(USER_ROLE.USER),
  GiftItemController.getMyGiftItems
);

router.post(
  '/',
  auth(USER_ROLE.USER),
  upload.array('images', 5),
  parseData(),
  validateRequest(GiftItemValidations.createGiftItemSchema),
  GiftItemController.createGiftItem
);

// ==========================================
// ADMIN LISTINGS MONITORING & SPOTLIGHT
// ==========================================
router.get(
  '/listings-monitoring',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  GiftItemController.getListingsMonitoring
);

router.patch(
  '/:id/spotlight',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(GiftItemValidations.toggleSpotlightSchema),
  GiftItemController.toggleSpotlight
);

router.get('/:id', GiftItemController.getGiftItemById);

router.patch(
  '/:id',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  upload.array('images', 5),
  parseData(),
  validateRequest(GiftItemValidations.updateGiftItemSchema),
  GiftItemController.updateGiftItem
);

router.delete(
  '/:id',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  GiftItemController.deleteGiftItem
);

// ==========================================
// 3. ADMIN REVIEW ROUTE
// ==========================================
router.patch(
  '/:id/review',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(GiftItemValidations.reviewGiftItemSchema),
  GiftItemController.reviewGiftItem
);

export const giftItemRoutes = router;
