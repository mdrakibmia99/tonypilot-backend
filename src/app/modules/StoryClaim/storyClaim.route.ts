import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import {
  createStoryClaimZodSchema,
  voteStoryClaimZodSchema,
  claimIdParamZodSchema,
  streamClaimsQueryZodSchema,
  giftClaimsQueryZodSchema,
} from './storyClaim.validation';
import { StoryClaimController } from './storyClaim.controller';

const upload = fileUpload('./public/uploads/claims', {
  maxFileSize: 15 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4'],
});
const router = Router();

/**
 * 1. Submit one story for a published gift using giftItemId.
 * POST /api/v1/story-claims
 */
router.post(
  '/',
  auth(USER_ROLE.USER,USER_ROLE.ADMIN),
  upload.single('storyMedia'),
  parseData(),
  validateRequest(createStoryClaimZodSchema),
  StoryClaimController.submitStoryClaim,
);

/**
 * 2. Get Story Claims for Live Stream ("Live Story Claims" Bottom Sheet)
 * GET /api/v1/story-claims/stream/:streamId
 */
router.get(
  '/stream/:streamId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL),
  validateRequest(streamClaimsQueryZodSchema),
  StoryClaimController.getClaimsForStream,
);

/**
 * Get stories for a gift from publication onward.
 * GET /api/v1/story-claims/gift/:giftItemId
 */
router.get(
  '/gift/:giftItemId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL),
  validateRequest(giftClaimsQueryZodSchema),
  StoryClaimController.getClaimsForGift,
);

/**
 * 3. Community Vote on Story Claim ("Community Story Voting")
 * POST /api/v1/story-claims/gift/:giftItemId/:storyClaimId/vote
 */
router.post(
  '/gift/:giftItemId/:storyClaimId/vote',
  auth(USER_ROLE.USER),
  validateRequest(voteStoryClaimZodSchema),
  StoryClaimController.voteStoryClaim,
);

/**
 * 4. Pin Story Claim to Stream Broadcast ("PINNED APPLICANT STORY")
 * PATCH /api/v1/story-claims/:id/pin
 */
router.patch(
  '/:id/pin',
  auth(USER_ROLE.USER),
  validateRequest(claimIdParamZodSchema),
  StoryClaimController.pinStoryClaim,
);

/**
 * 5. Unpin Story Claim from Stream
 * PATCH /api/v1/story-claims/:id/unpin
 */
router.patch(
  '/:id/unpin',
  auth(USER_ROLE.USER),
  validateRequest(claimIdParamZodSchema),
  StoryClaimController.unpinStoryClaim,
);

/**
 * 6. Award Gift Live (ACID Transaction) ("GIFT AWARDED LIVE!")
 * POST /api/v1/story-claims/:id/award
 */
router.post(
  '/:id/award',
  auth(USER_ROLE.USER),
  validateRequest(claimIdParamZodSchema),
  StoryClaimController.awardGiftLive,
);

/**
 * 7. Get Winner Pickup Instructions (Post-Award)
 * GET /api/v1/story-claims/:id/pickup-info
 */
router.get(
  '/:id/pickup-info',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(claimIdParamZodSchema),
  StoryClaimController.getPickupInstructions,
);

export const StoryClaimRoutes = router;
