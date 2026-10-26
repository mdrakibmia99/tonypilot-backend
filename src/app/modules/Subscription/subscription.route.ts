import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionValidations } from './subscription.validation';

const router = Router();

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
router.get('/plans', SubscriptionController.getActivePlans);

// Stripe Webhook Endpoint (Raw body verified via stripe-signature header)
router.post('/webhook', SubscriptionController.handleWebhook);

// ==========================================
// 2. AUTHENTICATED USER ROUTES
// ==========================================
router.get(
  '/my-status',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  SubscriptionController.getMySubscriptionStatus
);

router.post(
  '/checkout-session',
  auth(USER_ROLE.USER),
  validateRequest(SubscriptionValidations.createCheckoutSessionSchema),
  SubscriptionController.createCheckoutSession
);

router.patch(
  '/auto-renew',
  auth(USER_ROLE.USER),
  SubscriptionController.toggleAutoRenew
);

router.post(
  '/cancel',
  auth(USER_ROLE.USER),
  validateRequest(SubscriptionValidations.cancelSubscriptionSchema),
  SubscriptionController.cancelSubscription
);

// Card Save & Payment Method Management
router.post(
  '/setup-intent',
  auth(USER_ROLE.USER),
  SubscriptionController.createCardSetupIntent
);

router.get(
  '/payment-methods',
  auth(USER_ROLE.USER),
  SubscriptionController.getSavedPaymentMethods
);

router.patch(
  '/payment-methods/default',
  auth(USER_ROLE.USER),
  validateRequest(SubscriptionValidations.setDefaultPaymentMethodSchema),
  SubscriptionController.setDefaultPaymentMethod
);

router.delete(
  '/payment-methods/:id',
  auth(USER_ROLE.USER),
  SubscriptionController.deletePaymentMethod
);

// ==========================================
// 3. ADMIN PLAN MANAGEMENT
// ==========================================
router.post(
  '/admin/plans',
  auth(USER_ROLE.SUPER_ADMIN),
  validateRequest(SubscriptionValidations.createPlanSchema),
  SubscriptionController.createPlan
);

router.patch(
  '/admin/plans/:id',
  auth(USER_ROLE.SUPER_ADMIN),
  validateRequest(SubscriptionValidations.updatePlanSchema),
  SubscriptionController.updatePlan
);

export const subscriptionRoutes = router;
