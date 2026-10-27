import Stripe from 'stripe';
import config from '../../config';
import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { User } from '../user/user.models';
import { SubscriptionPlan, UserSubscription, PaymentTransaction } from './subscription.model';
import {
  TSubscriptionPlan,
  TSavedPaymentMethod,
} from './subscription.interface';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TIER,
  TIER_LIMITS,
} from './subscription.constants';
import {
  stripe,
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createCardSetupIntent as stripeCreateCardSetupIntent,
  listCustomerCards,
  setDefaultCard,
  removeCard,
  verifyStripeWebhookEvent,
} from './stripe.utils';
import { RedisService } from '../../redis';
import logger from '../../utils/logger';

// ==========================================
// 1. PUBLIC PLAN LISTING (CACHED)
// ==========================================
const getActivePlans = async (): Promise<TSubscriptionPlan[]> => {
  return await RedisService.getOrSet<TSubscriptionPlan[]>(
    'subscriptions:plans',
    async () => {
      return await SubscriptionPlan.find({ isActive: true })
        .sort({ sortOrder: 1, priceInCents: 1 })
        .lean();
    },
    3600 // 1 hour TTL
  );
};

// ==========================================
// 2. CHECKOUT SESSION CREATION
// ==========================================
const createCheckoutSession = async ({
  userId,
  planId
}: {
  userId: string;
  planId: string;
}) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription plan not found or inactive');
  }

  if (plan.tier === SUBSCRIPTION_TIER.FREE) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Free tier does not require checkout');
  }

  // Ensure customer exists in Stripe
  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await createSubscriptionCheckoutSession({
    customerId,
    stripePriceId: plan.stripePriceId,
    userId,
    planId: plan._id.toString(),
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
};

// ==========================================
// 3. USER SUBSCRIPTION STATUS & USAGE
// ==========================================
const getMySubscriptionStatus = async (userId: string) => {
  const cacheKey = `user:${userId}:subscription`;
  const cached = await RedisService.get(cacheKey);
  if (cached) return cached;

  const activeSub = await UserSubscription.findOne({
    user: new Types.ObjectId(userId),
    status: {
      $in: [
        SUBSCRIPTION_STATUS.ACTIVE,
        SUBSCRIPTION_STATUS.TRIALING,
        SUBSCRIPTION_STATUS.PAST_DUE,
      ],
    },
  })
    .populate('plan')
    .lean();

  let responseData;

  if (activeSub) {
    responseData = {
      hasActiveSubscription: activeSub.status === SUBSCRIPTION_STATUS.ACTIVE || activeSub.status === SUBSCRIPTION_STATUS.TRIALING,
      tier: activeSub.tier,
      status: activeSub.status,
      plan: activeSub.plan,
      currentPeriodStart: activeSub.currentPeriodStart,
      currentPeriodEnd: activeSub.currentPeriodEnd,
      autoRenew: activeSub.autoRenew,
      cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
      limits: TIER_LIMITS[activeSub.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free,
    };
  } else {
    responseData = {
      hasActiveSubscription: false,
      tier: SUBSCRIPTION_TIER.FREE,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      plan: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      limits: TIER_LIMITS.free,
    };
  }

  await RedisService.set(cacheKey, responseData, 300); // 5 min TTL
  return responseData;
};

// ==========================================
// 4. AUTO-RENEWAL MANAGEMENT
// ==========================================
const setAutoRenew = async (userId: string, autoRenew: boolean) => {
  const sub = await UserSubscription.findOne({
    user: new Types.ObjectId(userId),
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });

  if (!sub) {
    throw new AppError(httpStatus.NOT_FOUND, 'No active subscription found to modify');
  }

  // Stripe controls auto-renewal via cancel_at_period_end
  // autoRenew = true  -> cancel_at_period_end = false
  // autoRenew = false -> cancel_at_period_end = true
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: !autoRenew,
  });

  sub.autoRenew = autoRenew;
  sub.cancelAtPeriodEnd = !autoRenew;
  await sub.save();

  await RedisService.del(`user:${userId}:subscription`);

  return {
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
  };
};

// ==========================================
// 5. CANCEL SUBSCRIPTION
// ==========================================
const cancelSubscription = async (
  userId: string,
  payload: { cancelImmediately?: boolean; reason?: string }
) => {
  const sub = await UserSubscription.findOne({
    user: new Types.ObjectId(userId),
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE] },
  });

  if (!sub) {
    throw new AppError(httpStatus.NOT_FOUND, 'Active subscription not found');
  }

  if (payload.cancelImmediately) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    sub.status = SUBSCRIPTION_STATUS.CANCELED;
    sub.canceledAt = new Date();
    sub.autoRenew = false;
    sub.cancelReason = payload.reason || 'Immediate cancellation by user';
    await sub.save();

    await User.findByIdAndUpdate(userId, {
      subscriptionTier: SUBSCRIPTION_TIER.FREE,
      activeSubscription: null,
    });
  } else {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    sub.autoRenew = false;
    sub.cancelAtPeriodEnd = true;
    sub.cancelReason = payload.reason || 'Cancel at period end requested';
    await sub.save();
  }

  await RedisService.del(`user:${userId}:subscription`);

  return {
    status: sub.status,
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    effectiveDate: payload.cancelImmediately ? new Date() : sub.currentPeriodEnd,
  };
};

// ==========================================
// 6. CARD SAVE & PAYMENT METHOD MANAGEMENT
// ==========================================
const createSetupIntentForCard = async (userId: string) => {
  const customerId = await getOrCreateStripeCustomer(userId);
  const setupIntent = await stripeCreateCardSetupIntent(customerId);
  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };
};

const getSavedPaymentMethods = async (userId: string): Promise<TSavedPaymentMethod[]> => {
  const user = await User.findById(userId);
  if (!user || !user.stripeCustomerId) {
    return [];
  }
  return await listCustomerCards(user.stripeCustomerId);
};

const setDefaultPaymentMethod = async (userId: string, paymentMethodId: string) => {
  const user = await User.findById(userId);
  if (!user || !user.stripeCustomerId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Customer account not found');
  }
  await setDefaultCard(user.stripeCustomerId, paymentMethodId);
  return { success: true, message: 'Default payment method updated' };
};

const deletePaymentMethod = async (userId: string, paymentMethodId: string) => {
  const user = await User.findById(userId);
  if (!user || !user.stripeCustomerId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Customer account not found');
  }
  await removeCard(paymentMethodId);
  return { success: true, message: 'Card removed successfully' };
};

// ==========================================
// 7. STRIPE WEBHOOK EVENT PROCESSING
// ==========================================
const handleWebhookEvent = async (event: Stripe.Event) => {
  logger.info(`[Stripe Webhook] Processing event: ${event.type} [${event.id}]`);

  switch (event.type) {
    // -------------------------------------------------------------------------
    // A. Initial Checkout Completion (New Subscription Provisioning)
    // -------------------------------------------------------------------------
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const stripeSub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ['default_payment_method'] }
        );

        const userId = session.metadata?.userId || stripeSub.metadata?.userId;
        const planId = session.metadata?.planId || stripeSub.metadata?.planId;
        if (userId && planId) {
          const plan = await SubscriptionPlan.findById(planId);
          if (plan) {

            const userSub = await UserSubscription.findOneAndUpdate(
              { stripeSubscriptionId: stripeSub.id },
              {
                user: new Types.ObjectId(userId),
                plan: plan._id,
                tier: plan.tier,
                status: SUBSCRIPTION_STATUS.ACTIVE,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: stripeSub.id,
                stripeLatestInvoiceId: (stripeSub.latest_invoice as string) || '',
                autoRenew: !stripeSub.cancel_at_period_end,
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                billingCycle: plan.billingCycle,
                priceInCents: plan.priceInCents,
                currency: plan.currency,
                currentPeriodStart: new Date(((stripeSub as any).current_period_start ?? (stripeSub as any).start_date) * 1000),
                currentPeriodEnd: new Date(((stripeSub as any).current_period_end ?? ((stripeSub as any).start_date + (plan.billingCycle === "monthly" ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60))) * 1000),
                lastWebhookEvent: event.type,
                lastWebhookAt: new Date(),
              },
              { upsert: true, new: true }
            );
            // Update User document
            await User.findByIdAndUpdate(userId, {
              subscriptionTier: plan.tier,
              activeSubscription: userSub._id,
              stripeCustomerId: session.customer as string,
              subscriptionExpiresAt: new Date(((stripeSub as any).current_period_end ?? ((stripeSub as any).start_date + (plan.billingCycle === "monthly" ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60))) * 1000),
            });

            // Evict caches
            await RedisService.del(`user:${userId}:subscription`);
            await RedisService.del('admin:revenue:summary');
            logger.info(`[Stripe Webhook] Provisioned subscription for user ${userId} to ${plan.tier}`);
          }
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // B. Recurring Invoice Paid -> AUTO-RENEWAL TRIGGER
    // -------------------------------------------------------------------------
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any;
      if (invoice.subscription) {
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
        
        let stripeSub: any = null;
        try {
          stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        } catch {
          // If mock or disconnected, fallback to invoice dates
        }

        const periodStart = stripeSub ? new Date((stripeSub as any).current_period_start * 1000) : (invoice.period_start ? new Date(invoice.period_start * 1000) : new Date());
        const periodEnd = stripeSub ? new Date((stripeSub as any).current_period_end * 1000) : (invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        const cancelAtPeriodEnd = stripeSub ? stripeSub.cancel_at_period_end : false;

        const updatedSub = await UserSubscription.findOneAndUpdate(
          { stripeSubscriptionId: stripeSubId },
          {
            status: SUBSCRIPTION_STATUS.ACTIVE,
            autoRenew: !cancelAtPeriodEnd,
            cancelAtPeriodEnd,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            lastWebhookEvent: event.type,
            lastWebhookAt: new Date(),
          },
          { new: true }
        );

        if (updatedSub) {
          await User.findByIdAndUpdate(updatedSub.user, {
            subscriptionExpiresAt: periodEnd,
          });

          // Record payment transaction
          await PaymentTransaction.create({
            user: updatedSub.user,
            subscription: updatedSub._id,
            stripePaymentIntentId: (invoice.payment_intent as string) || `inv_pi_${invoice.id}`,
            stripeInvoiceId: invoice.id,
            type: 'subscription_payment',
            status: 'succeeded',
            amountInCents: invoice.amount_paid || 0,
            currency: invoice.currency || 'usd',
            description: `Automatic renewal for ${updatedSub.tier} tier (${updatedSub.billingCycle})`,
            metadata: { invoiceId: invoice.id },
          });

          await RedisService.del(`user:${updatedSub.user.toString()}:subscription`);
          await RedisService.del('admin:revenue:summary');
          logger.info(`[Stripe Webhook] Auto-renewal succeeded for subscription ${stripeSubId}`);
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // C. Invoice Payment Failed (Auto-renewal Failed)
    // -------------------------------------------------------------------------
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any;
      if (invoice.subscription) {
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
        const failedSub = await UserSubscription.findOneAndUpdate(
          { stripeSubscriptionId: stripeSubId },
          {
            status: SUBSCRIPTION_STATUS.PAST_DUE,
            lastWebhookEvent: event.type,
            lastWebhookAt: new Date(),
          },
          { new: true }
        );

        if (failedSub) {
          await PaymentTransaction.create({
            user: failedSub.user,
            subscription: failedSub._id,
            stripePaymentIntentId: (invoice.payment_intent as string) || `inv_failed_${invoice.id}`,
            stripeInvoiceId: invoice.id,
            type: 'subscription_payment',
            status: 'failed',
            amountInCents: invoice.amount_due || 0,
            currency: invoice.currency || 'usd',
            description: `Auto-renewal payment failed for ${failedSub.tier}`,
            failureReason: invoice.last_finalization_error?.message || 'Payment method declined',
          });

          await RedisService.del(`user:${failedSub.user.toString()}:subscription`);
          logger.warn(`[Stripe Webhook] Auto-renewal failed for subscription ${stripeSubId}`);
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // D. Subscription Canceled / Expired
    // -------------------------------------------------------------------------
    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as any;
      const canceledSub = await UserSubscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSub.id },
        {
          status: SUBSCRIPTION_STATUS.CANCELED,
          autoRenew: false,
          canceledAt: new Date(),
          lastWebhookEvent: event.type,
          lastWebhookAt: new Date(),
        },
        { new: true }
      );

      if (canceledSub) {
        await User.findByIdAndUpdate(canceledSub.user, {
          subscriptionTier: SUBSCRIPTION_TIER.FREE,
          activeSubscription: null,
          subscriptionExpiresAt: null,
        });

        await RedisService.del(`user:${canceledSub.user.toString()}:subscription`);
        await RedisService.del('admin:revenue:summary');
        logger.info(`[Stripe Webhook] Subscription canceled: ${stripeSub.id}`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // E. Subscription Updated (Auto-renew toggle or tier change)
    // -------------------------------------------------------------------------
    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as any;
      const updated = await UserSubscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSub.id },
        {
          autoRenew: !stripeSub.cancel_at_period_end,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          currentPeriodStart: new Date(((stripeSub as any).current_period_start ?? (stripeSub as any).start_date) * 1000),
          currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
          lastWebhookEvent: event.type,
          lastWebhookAt: new Date(),
        },
        { new: true }
      );

      if (updated) {
        await RedisService.del(`user:${updated.user.toString()}:subscription`);
      }
      break;
    }

    default:
      logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
};

const processWebhook = async (rawBody: Buffer | string, signature: string) => {
  const secret = config.stripe.stripe_webhook_secret;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookEvent(rawBody, signature, secret);
  } catch (err: any) {
    logger.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
    throw new AppError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
  }

  await handleWebhookEvent(event);
};

// ==========================================
// 8. ADMIN PLAN MANAGEMENT
// ==========================================
const createPlan = async (payload: Partial<TSubscriptionPlan>) => {
  const created = await SubscriptionPlan.create(payload);
  await RedisService.del('subscriptions:plans');
  return created;
};

const updatePlan = async (id: string, payload: Partial<TSubscriptionPlan>) => {
  const updated = await SubscriptionPlan.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription plan not found');
  }
  await RedisService.del('subscriptions:plans');
  return updated;
};

export const SubscriptionService = {
  getActivePlans,
  createCheckoutSession,
  getMySubscriptionStatus,
  setAutoRenew,
  cancelSubscription,
  createSetupIntentForCard,
  getSavedPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  processWebhook,
  handleWebhookEvent,
  createPlan,
  updatePlan,
};
