import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import {
  createLiveCommentZodSchema,
  commentIdParamZodSchema,
  streamCommentsQueryZodSchema,
  createModerationReportZodSchema,
} from './liveComment.validation';
import { LiveCommentController } from './liveComment.controller';

const commentRouter = Router();
const moderationRouter = Router();

// ==========================================
// LIVE COMMENT ROUTES
// ==========================================

/**
 * 1. Post a Live Stream Comment
 * POST /api/v1/live-comments
 */
commentRouter.post(
  '/',
  auth(USER_ROLE.USER),
  validateRequest(createLiveCommentZodSchema),
  LiveCommentController.sendLiveComment,
);

/**
 * 2. Get Live Comments for Stream
 * GET /api/v1/live-comments/stream/:streamId
 */
commentRouter.get(
  '/stream/:streamId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL),
  validateRequest(streamCommentsQueryZodSchema),
  LiveCommentController.getStreamComments,
);

/**
 * 3. Pin Comment to Broadcast Overlay
 * PATCH /api/v1/live-comments/:id/pin
 */
commentRouter.patch(
  '/:id/pin',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(commentIdParamZodSchema),
  LiveCommentController.pinComment,
);

/**
 * 4. Unpin Comment
 * PATCH /api/v1/live-comments/:id/unpin
 */
commentRouter.patch(
  '/:id/unpin',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(commentIdParamZodSchema),
  LiveCommentController.unpinComment,
);

/**
 * 5. Moderation Delete Comment
 * DELETE /api/v1/live-comments/:id
 */
commentRouter.delete(
  '/:id',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(commentIdParamZodSchema),
  LiveCommentController.deleteCommentByMod,
);

// ==========================================
// MODERATION REPORT ROUTES
// ==========================================

/**
 * 6. Submit a Moderation Report / Flag
 * POST /api/v1/moderation/report
 */
moderationRouter.post(
  '/report',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(createModerationReportZodSchema),
  LiveCommentController.createModerationReport,
);

export const LiveCommentRoutes = commentRouter;
export const ModerationRoutes = moderationRouter;
