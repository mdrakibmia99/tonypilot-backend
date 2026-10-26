import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SubscriptionService } from './subscription.service';

// 1. Get active plans (cached)
const getActivePlans = catchAsync(async (_req: Request, res: Response) => {
  const result = await SubscriptionService.getActivePlans();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plans retrieved successfully',
    data: result,
  });
});

// 2. Create checkout session
const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await SubscriptionService.createCheckoutSession({
    userId,
    ...req.body,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout session created successfully',
    data: result,
  });
});

// 3. Get my subscription status & limits
const getMySubscriptionStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await SubscriptionService.getMySubscriptionStatus(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription status retrieved successfully',
    data: result,
  });
});

// 4. Toggle auto-renewal (Enable or Disable)
const toggleAutoRenew = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { autoRenew } = req.body;
  const result = await SubscriptionService.setAutoRenew(userId, Boolean(autoRenew));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: autoRenew
      ? 'Auto-renewal enabled successfully'
      : 'Auto-renewal disabled. Subscription will expire at period end.',
    data: result,
  });
});

// 5. Cancel subscription
const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await SubscriptionService.cancelSubscription(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription cancellation processed successfully',
    data: result,
  });
});

// 6. Create SetupIntent to save a card
const createCardSetupIntent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await SubscriptionService.createSetupIntentForCard(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Card setup intent created successfully',
    data: result,
  });
});

// 7. Get saved payment methods (saved cards)
const getSavedPaymentMethods = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await SubscriptionService.getSavedPaymentMethods(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Saved payment methods retrieved successfully',
    data: result,
  });
});

// 8. Set default payment method
const setDefaultPaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { paymentMethodId } = req.body;
  const result = await SubscriptionService.setDefaultPaymentMethod(userId, paymentMethodId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Default payment method updated successfully',
    data: result,
  });
});

// 9. Delete saved payment method
const deletePaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const id = req.params.id as string;
  const result = await SubscriptionService.deletePaymentMethod(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment method removed successfully',
    data: result,
  });
});

// 10. Webhook ingestion endpoint
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const rawBody = (req as any).rawBody || req.body;

  await SubscriptionService.processWebhook(rawBody, signature);

  res.status(httpStatus.OK).json({ received: true });
});

// 11. Admin Create Plan
const createPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.createPlan(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Subscription plan created successfully',
    data: result,
  });
});

// 12. Admin Update Plan
const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await SubscriptionService.updatePlan(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plan updated successfully',
    data: result,
  });
});

export const SubscriptionController = {
  getActivePlans,
  createCheckoutSession,
  getMySubscriptionStatus,
  toggleAutoRenew,
  cancelSubscription,
  createCardSetupIntent,
  getSavedPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  handleWebhook,
  createPlan,
  updatePlan,
};
