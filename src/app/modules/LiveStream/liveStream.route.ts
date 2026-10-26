import express from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import {
  preLiveInitZodSchema,
  streamIdParamZodSchema,
  zegoWebhookZodSchema,
} from './liveStream.validation';
import { LiveStreamController } from './liveStream.controller';

const router = express.Router();

/**
 * 1. Initialize Pre-Live Studio Session
 * POST /api/v1/live-streams/pre-live-init
 */
router.post(
  '/pre-live-init',
  auth(USER_ROLE.USER),
  validateRequest(preLiveInitZodSchema),
  LiveStreamController.preLiveInit,
);

/**
 * 2. Start Broadcast
 * POST /api/v1/live-streams/:id/start
 */
router.post(
  '/:id/start',
  auth(USER_ROLE.USER),
  validateRequest(streamIdParamZodSchema),
  LiveStreamController.startBroadcast,
);

/**
 * 3. Join Live Stream (Viewer or Host)
 * POST /api/v1/live-streams/:id/join
 */
router.post(
  '/:id/join',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL),
  validateRequest(streamIdParamZodSchema),
  LiveStreamController.joinLiveStream,
);

/**
 * 4. Get Active Public Streams ("Others Live" / "More Live Today")
 * GET /api/v1/live-streams/active
 */
router.get('/active', LiveStreamController.getActiveStreams);

/**
 * 5. End Broadcast
 * POST /api/v1/live-streams/:id/end
 */
router.post(
  '/:id/end',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(streamIdParamZodSchema),
  LiveStreamController.endBroadcast,
);

/**
 * 6. Get Stream Wrap-Up Summary ("Broadcast Finished!")
 * GET /api/v1/live-streams/:id/wrap-up
 */
router.get(
  '/:id/wrap-up',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL),
  validateRequest(streamIdParamZodSchema),
  LiveStreamController.getWrapUpSummary,
);

/**
 * 7. ZEGOCLOUD Lifecycle Webhook Handler
 * POST /api/v1/live-streams/webhook/zego
 */
router.post(
  '/webhook/zego',
  validateRequest(zegoWebhookZodSchema),
  LiveStreamController.handleZegoWebhook,
);

export const LiveStreamRoutes = router;
