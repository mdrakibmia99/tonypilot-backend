import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { SaveGiftController } from './saveGift.controller';
import { SaveGiftValidation } from './saveGift.validation';

const router = Router();

/**
 * 1. Add gift item to saved list (or notify if already saved)
 * POST /api/v1/save-gifts/add
 */
router.post(
  '/add',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(SaveGiftValidation.addSaveGiftZodSchema),
  SaveGiftController.addGiftToSave,
);

/**
 * 2. Get user's saved gifts list with pagination
 * GET /api/v1/save-gifts/my-saved-gifts
 */
router.get(
  '/my-saved-gifts',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  SaveGiftController.getMySavedGifts,
);

/**
 * 3. Check if a gift item is saved by the current user
 * GET /api/v1/save-gifts/check/:giftItemId
 */
router.get(
  '/check/:giftItemId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(SaveGiftValidation.removeSaveGiftZodSchema),
  SaveGiftController.checkIsGiftSaved,
);

/**
 * 4. Remove a gift item from saved list
 * DELETE /api/v1/save-gifts/:giftItemId
 */
router.delete(
  '/:giftItemId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(SaveGiftValidation.removeSaveGiftZodSchema),
  SaveGiftController.removeSavedGift,
);

export const saveGiftRoutes = router;
