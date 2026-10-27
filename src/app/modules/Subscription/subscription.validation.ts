import { z } from 'zod';
import { Types } from 'mongoose';
import { BILLING_CYCLE, SUBSCRIPTION_TIER } from './subscription.constants';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

const createCheckoutSessionSchema = z.object({
  body: z.object({
    planId: z.string().refine(objectIdValidator, { message: 'Invalid plan ID' })
  }),
});

const cancelSubscriptionSchema = z.object({
  body: z.object({
    cancelImmediately: z.boolean().default(false),
    reason: z.string().max(500).optional(),
  }),
});

const createPlanSchema = z.object({
  body: z.object({
    tier: z.enum(Object.values(SUBSCRIPTION_TIER) as [string, ...string[]]),
    name: z.string().min(1).max(50),
    description: z.string().min(1).max(200),
    billingCycle: z.enum(Object.values(BILLING_CYCLE) as [string, ...string[]]),
    priceInCents: z.number().int().min(0),
    currency: z.string().default('usd'),
    stripePriceId: z.string().min(1),
    stripeProductId: z.string().min(1),
    features: z.object({
      maxGiftPostsPerMonth: z.number().int(),
      maxLiveStreamsPerMonth: z.number().int(),
      maxStreamDurationMinutes: z.number().int(),
      maxStoryClaimsPerDay: z.number().int(),
      priorityInDiscoverFeed: z.boolean().default(false),
      verifiedBadge: z.boolean().default(false),
      analyticsAccess: z.boolean().default(false),
      adFreeExperience: z.boolean().default(false),
    }),
    trialDays: z.number().int().min(0).default(0),
    sortOrder: z.number().int().default(0),
  }),
});

const updatePlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    features: z
      .object({
        maxGiftPostsPerMonth: z.number().int().optional(),
        maxLiveStreamsPerMonth: z.number().int().optional(),
        maxStreamDurationMinutes: z.number().int().optional(),
        maxStoryClaimsPerDay: z.number().int().optional(),
        priorityInDiscoverFeed: z.boolean().optional(),
        verifiedBadge: z.boolean().optional(),
        analyticsAccess: z.boolean().optional(),
        adFreeExperience: z.boolean().optional(),
      })
      .optional(),
  }),
});

const setDefaultPaymentMethodSchema = z.object({
  body: z.object({
    paymentMethodId: z.string().min(1, { message: 'paymentMethodId is required' }),
  }),
});

export const SubscriptionValidations = {
  createCheckoutSessionSchema,
  cancelSubscriptionSchema,
  createPlanSchema,
  updatePlanSchema,
  setDefaultPaymentMethodSchema,
};
