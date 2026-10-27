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
          { expand: ['default_payment_method', 'latest_invoice'] }
        );

        const userId = session.metadata?.userId || stripeSub.metadata?.userId;
        const planId = session.metadata?.planId || stripeSub.metadata?.planId;
        if (userId && planId) {
          const plan = await SubscriptionPlan.findById(planId);
          if (plan) {
            const latestInvoiceObj = typeof stripeSub.latest_invoice === 'object' ? (stripeSub.latest_invoice as any) : null;
            const invoiceId = latestInvoiceObj?.id || (typeof stripeSub.latest_invoice === 'string' ? stripeSub.latest_invoice : (session.invoice as string) || '');

            const periodStart = new Date(((stripeSub as any).current_period_start ?? (stripeSub as any).start_date ?? Math.floor(Date.now() / 1000)) * 1000);
            const periodEnd = new Date(((stripeSub as any).current_period_end ?? ((stripeSub as any).start_date ? (stripeSub as any).start_date + (plan.billingCycle === 'monthly' ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60) : Math.floor(Date.now() / 1000) + (plan.billingCycle === 'monthly' ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60))) * 1000);

            const userSub = await UserSubscription.findOneAndUpdate(
              { stripeSubscriptionId: stripeSub.id },
              {
                user: new Types.ObjectId(userId),
                plan: plan._id,
                tier: plan.tier,
                status: SUBSCRIPTION_STATUS.ACTIVE,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: stripeSub.id,
                stripeLatestInvoiceId: invoiceId,
                autoRenew: !stripeSub.cancel_at_period_end,
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                billingCycle: plan.billingCycle,
                priceInCents: plan.priceInCents,
                currency: plan.currency,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
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
              subscriptionExpiresAt: periodEnd,
            });

            // Record initial payment transaction idempotently
            let paymentIntentId = (session.payment_intent as string) || '';
            if (!paymentIntentId && latestInvoiceObj?.payment_intent) {
              paymentIntentId = typeof latestInvoiceObj.payment_intent === 'string'
                ? latestInvoiceObj.payment_intent
                : latestInvoiceObj.payment_intent?.id || '';
            }
            if (!paymentIntentId && invoiceId) {
              paymentIntentId = `inv_pi_${invoiceId}`;
            } else if (!paymentIntentId) {
              paymentIntentId = `cs_pi_${session.id}`;
            }

            await PaymentTransaction.findOneAndUpdate(
              { stripePaymentIntentId: paymentIntentId },
              {
                $setOnInsert: {
                  user: new Types.ObjectId(userId),
                  subscription: userSub._id,
                  stripePaymentIntentId: paymentIntentId,
                  stripeInvoiceId: invoiceId,
                  type: 'subscription_payment',
                  status: 'succeeded',
                  amountInCents: session.amount_total || plan.priceInCents,
                  currency: session.currency || plan.currency || 'usd',
                  description: `Initial payment for ${plan.name} (${plan.tier}) - ${plan.billingCycle}`,
                  metadata: {
                    sessionId: session.id,
                    planId: plan._id.toString(),
                    invoiceId: invoiceId || '',
                  },
                },
              },
              { upsert: true, new: true }
            );

            // Evict caches
            await RedisService.del(`user:${userId}:subscription`);
            await RedisService.del('admin:revenue:summary');
            logger.info(`[Stripe Webhook] Provisioned subscription and recorded initial transaction for user ${userId} to ${plan.tier}`);
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
      console.log(invoice ,"check invoice==============>")
      if (invoice.subscription) {
        console.log('check subscription ================')
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
        
        let stripeSub: any = null;
        try {
          stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        } catch {
          // If mock or disconnected, fallback to existing DB data
        }

        // 1. Fetch existing UserSubscription
        const existingSub = await UserSubscription.findOne({ stripeSubscriptionId: stripeSubId });

        // 2. Determine billing cycle and duration (monthly = 30 days, yearly = 365 days)
        const billingCycle = existingSub?.billingCycle || (stripeSub?.items?.data?.[0]?.plan?.interval === 'year' ? 'yearly' : 'monthly');
        const daysToAdd = billingCycle === 'yearly' ? 365 : 30;
        const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;

        // 3. Determine period bounds from Stripe (Line items or Subscription items)
        const linePeriodStart = invoice.lines?.data?.[0]?.period?.start;
        const linePeriodEnd = invoice.lines?.data?.[0]?.period?.end;
        const subItemStart = stripeSub?.items?.data?.[0]?.current_period_start ?? stripeSub?.current_period_start;
        const subItemEnd = stripeSub?.items?.data?.[0]?.current_period_end ?? stripeSub?.current_period_end;

        let periodStart: Date;
        let periodEnd: Date;

        if (linePeriodEnd && (!linePeriodStart || linePeriodEnd > linePeriodStart)) {
          // Priority 1: Stripe invoice line item period (most accurate for Stripe Test Clocks)
          periodEnd = new Date(linePeriodEnd * 1000);
          periodStart = linePeriodStart ? new Date(linePeriodStart * 1000) : new Date(periodEnd.getTime() - msToAdd);
        } else if (subItemEnd && (!subItemStart || subItemEnd > subItemStart)) {
          // Priority 2: Stripe subscription item period
          periodEnd = new Date(subItemEnd * 1000);
          periodStart = subItemStart ? new Date(subItemStart * 1000) : new Date(periodEnd.getTime() - msToAdd);
        } else {
          // Priority 3: Add daysToAdd to previous currentPeriodEnd
          let baseTime = Date.now();
          if (existingSub?.currentPeriodEnd) {
            const prevTime = new Date(existingSub.currentPeriodEnd).getTime();
            if (!isNaN(prevTime)) {
              baseTime = prevTime;
            }
          }
          periodStart = new Date(baseTime);
          periodEnd = new Date(baseTime + msToAdd);
        }

        // Guarantees auto-renewal always advances past previous end date:
        if (existingSub?.currentPeriodEnd) {
          const prevEndTime = new Date(existingSub.currentPeriodEnd).getTime();
          if (!isNaN(prevEndTime) && periodEnd.getTime() <= prevEndTime) {
            periodStart = new Date(prevEndTime);
            periodEnd = new Date(prevEndTime + msToAdd);
          }
        }

        const cancelAtPeriodEnd = stripeSub ? stripeSub.cancel_at_period_end : (existingSub?.cancelAtPeriodEnd ?? false);

        const updatedSub = await UserSubscription.findOneAndUpdate(
          { stripeSubscriptionId: stripeSubId },
          {
            status: SUBSCRIPTION_STATUS.ACTIVE,
            stripeLatestInvoiceId: invoice.id || (stripeSub?.latest_invoice as string) || '',
            autoRenew: !cancelAtPeriodEnd,
            cancelAtPeriodEnd,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            lastWebhookEvent: event.type,
            lastWebhookAt: new Date(),
          },
          { new: true }
        );
      console.log(updatedSub,"updatedSub=============>")
        if (updatedSub) {
          // Explicitly update User model's subscriptionExpiresAt
        const updateUser=  await User.findByIdAndUpdate(updatedSub.user, {
            subscriptionTier: updatedSub.tier,
            subscriptionExpiresAt: periodEnd,
          });
          console.log(updateUser,"updateUser================>")

          // Record payment transaction idempotently
          const paymentIntentId = (invoice.payment_intent as string) || `inv_pi_${invoice.id}`;
          console.log(invoice,"invoice=============>")
          await PaymentTransaction.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId },
            {
              $setOnInsert: {
                user: updatedSub.user,
                subscription: updatedSub._id,
                stripePaymentIntentId: paymentIntentId,
                stripeInvoiceId: invoice.id,
                type: 'subscription_payment',
                status: 'succeeded',
                amountInCents: invoice.amount_paid || invoice.total || 0,
                currency: invoice.currency || 'usd',
                description: `Automatic renewal for ${updatedSub.tier} tier (${updatedSub.billingCycle})`,
                metadata: {
                  invoiceId: invoice.id,
                  billingReason: invoice.billing_reason || 'subscription_cycle',
                },
              },
            },
            { upsert: true, new: true }
          );

          await RedisService.del(`user:${updatedSub.user.toString()}:subscription`);
          await RedisService.del('admin:revenue:summary');
          logger.info(`[Stripe Webhook] Auto-renewal succeeded for subscription ${stripeSubId}. User ${updatedSub.user} expiresAt updated to: ${periodEnd.toISOString()}`);
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
      const updateData: any = {
        autoRenew: !stripeSub.cancel_at_period_end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        lastWebhookEvent: event.type,
        lastWebhookAt: new Date(),
      };

      if (stripeSub.latest_invoice) {
        updateData.stripeLatestInvoiceId = typeof stripeSub.latest_invoice === 'string'
          ? stripeSub.latest_invoice
          : stripeSub.latest_invoice.id;
      }

      const itemEnd = stripeSub.items?.data?.[0]?.current_period_end ?? stripeSub.current_period_end;
      const itemStart = stripeSub.items?.data?.[0]?.current_period_start ?? stripeSub.current_period_start;

      if (itemStart) {
        updateData.currentPeriodStart = new Date(itemStart * 1000);
      }
      if (itemEnd) {
        updateData.currentPeriodEnd = new Date(itemEnd * 1000);
      }

      const updated = await UserSubscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSub.id },
        updateData,
        { new: true }
      );

      if (updated) {
        if (updateData.currentPeriodEnd) {
          await User.findByIdAndUpdate(updated.user, {
            subscriptionTier: updated.tier,
            subscriptionExpiresAt: updateData.currentPeriodEnd,
          });
        }

        // Record payment transaction if an invoice is attached and paid
        if (stripeSub.latest_invoice) {
          try {
            const invoiceId = typeof stripeSub.latest_invoice === 'string'
              ? stripeSub.latest_invoice
              : stripeSub.latest_invoice.id;

            let invoiceObj = typeof stripeSub.latest_invoice === 'object'
              ? stripeSub.latest_invoice
              : null;

            if (!invoiceObj && invoiceId) {
              invoiceObj = await stripe.invoices.retrieve(invoiceId);
            }

            if (invoiceObj && (invoiceObj.status === 'paid' || invoiceObj.paid)) {
              const paymentIntentId = (typeof invoiceObj.payment_intent === 'string'
                ? invoiceObj.payment_intent
                : invoiceObj.payment_intent?.id) || `inv_pi_${invoiceId}`;

              await PaymentTransaction.findOneAndUpdate(
                { stripePaymentIntentId: paymentIntentId },
                {
                  $setOnInsert: {
                    user: updated.user,
                    subscription: updated._id,
                    stripePaymentIntentId: paymentIntentId,
                    stripeInvoiceId: invoiceId,
                    type: 'subscription_payment',
                    status: 'succeeded',
                    amountInCents: invoiceObj.amount_paid || invoiceObj.total || updated.priceInCents,
                    currency: invoiceObj.currency || updated.currency || 'usd',
                    description: `Automatic renewal for ${updated.tier} tier (${updated.billingCycle})`,
                    metadata: {
                      invoiceId: invoiceId,
                      billingReason: invoiceObj.billing_reason || 'subscription_cycle',
                    },
                  },
                },
                { upsert: true, new: true }
              );
              await RedisService.del('admin:revenue:summary');
              logger.info(`[Stripe Webhook] Transaction recorded in customer.subscription.updated for invoice ${invoiceId}`);
            }
          } catch (err: any) {
            logger.warn(`[Stripe Webhook] Failed to record transaction in customer.subscription.updated: ${err.message}`);
          }
        }

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
