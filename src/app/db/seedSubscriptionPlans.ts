import { SubscriptionPlan } from '../modules/Subscription/subscription.model';
import {
  BILLING_CYCLE,
  SUBSCRIPTION_TIER,
  TIER_LIMITS,
} from '../modules/Subscription/subscription.constants';
import logger from '../utils/logger';

const defaultPlans = [
  {
    tier: SUBSCRIPTION_TIER.FREE,
    name: 'Free Neighbor',
    description: 'Perfect for neighbors getting started with radical trust and giving.',
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceInCents: 0,
    currency: 'usd',
    stripePriceId: 'price_free_tier',
    stripeProductId: 'prod_free_tier',
    features: TIER_LIMITS.free,
    isActive: true,
    sortOrder: 1,
    trialDays: 0,
  },
  {
    tier: SUBSCRIPTION_TIER.PREMIUM,
    name: 'Community Patron',
    description: 'Boosted visibility, priority discover placement, and extended live streaming.',
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceInCents: 999, // $9.99/mo
    currency: 'usd',
    stripePriceId: 'price_premium_monthly_tonypilot',
    stripeProductId: 'prod_premium_tonypilot',
    features: TIER_LIMITS.premium,
    isActive: true,
    sortOrder: 2,
    trialDays: 7,
  },
  {
    tier: SUBSCRIPTION_TIER.PRO,
    name: 'Generosity Champion',
    description: 'Unlimited gift posts, unlimited streaming, verified donor badge & analytics.',
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceInCents: 2499, // $24.99/mo
    currency: 'usd',
    stripePriceId: 'price_pro_monthly_tonypilot',
    stripeProductId: 'prod_pro_tonypilot',
    features: TIER_LIMITS.pro,
    isActive: true,
    sortOrder: 3,
    trialDays: 0,
  },
];

export const seedDefaultSubscriptionPlans = async () => {
  try {
    const existingCount = await SubscriptionPlan.countDocuments();
    if (existingCount === 0) {
      await SubscriptionPlan.insertMany(defaultPlans);
      logger.info('✅ Default subscription plans (Free, Premium, Pro) seeded successfully');
    }
  } catch (error: any) {
    logger.warn(`Failed to seed subscription plans: ${error.message}`);
  }
};
