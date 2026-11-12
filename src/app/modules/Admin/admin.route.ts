import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { adminValidation } from './admin.validation';
import { adminController } from './admin.controller';

const router = Router();

// ==========================================
// 1. TELEMETRY & KPIS
// ==========================================
router.get(
  '/dashboard/telemetry',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getTelemetryOverview,
);

router.get(
  '/dashboard/overview',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getTelemetryOverview,
);

// ==========================================
// 2. LIVE STREAM ACTIVE CONTROL ROOM
// ==========================================
router.get(
  '/live-streams/active',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getActiveLiveStreamsControlRoom,
);

router.patch(
  '/live-streams/:id/force-terminate',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(adminValidation.forceTerminateStreamZodSchema),
  adminController.forceTerminateStream,
);

router.patch(
  '/live-streams/:id/mute-host',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(adminValidation.muteHostZodSchema),
  adminController.muteHost,
);

// ==========================================
// 3. USER MODERATION (WARN, SUSPEND, BAN, UNBAN)
// ==========================================
router.patch(
  '/users/:id/moderation-action',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(adminValidation.userModerationActionZodSchema),
  adminController.takeUserModerationAction,
);
router.patch(
  '/users/:id/block-status',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(adminValidation.updateUserBlockStatusZodSchema),
  adminController.updateUserBlockStatus,
);
router.get(
  '/users',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getSupervisedUsers,
);

router.get(
  '/users/supervision',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getSupervisedUsers,
);

router.get(
  '/users/:id/inspect',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getUserInspectionDetails,
);


// ==========================================
// 4. STORIES & CLAIMS AUDIT
// ==========================================
router.patch(
  '/story-claims/:id/review',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(adminValidation.reviewStoryClaimZodSchema),
  adminController.reviewStoryClaim,
);

// ==========================================
// 5. AUDIT LOGS & REVENUE ANALYTICS
// ==========================================
router.get(
  '/audit-logs',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getAdminAuditLogs,
);

router.get(
  '/revenue/analytics',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getRevenueAnalytics,
);

router.get(
  '/revenue/overview',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getRevenueAnalytics,
);

router.get(
  '/revenue',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getRevenueAnalytics,
);

router.get(
  '/revenue/settlements',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.getGatewaySettlements,
);

// ==========================================
// LEGACY COMPATIBILITY
// ==========================================
router.patch(
  '/block/:id',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.blockedUser,
);

router.delete(
  '/delete/:id',
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  adminController.deleteUser,
);

export const adminRoutes = router;
