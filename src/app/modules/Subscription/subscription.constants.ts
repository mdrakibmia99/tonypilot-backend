export const SUBSCRIPTION_TIER = {
  FREE: 'free',
  PREMIUM: 'premium',
  PRO: 'pro',
} as const;

export type TSubscriptionTier = typeof SUBSCRIPTION_TIER[keyof typeof SUBSCRIPTION_TIER];

export const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export type TBillingCycle = typeof BILLING_CYCLE[keyof typeof BILLING_CYCLE];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  UNPAID: 'unpaid',
  INCOMPLETE: 'incomplete',
  EXPIRED: 'expired',
} as const;

export type TSubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const TIER_LIMITS = {
  free: {
    maxGiftPostsPerMonth: 3,
    maxLiveStreamsPerMonth: 1,
    maxStreamDurationMinutes: 15,
    maxStoryClaimsPerDay: 3,
    priorityInDiscoverFeed: false,
    verifiedBadge: false,
    analyticsAccess: false,
    adFreeExperience: false,
  },
  premium: {
    maxGiftPostsPerMonth: 20,
    maxLiveStreamsPerMonth: 10,
    maxStreamDurationMinutes: 60,
    maxStoryClaimsPerDay: 15,
    priorityInDiscoverFeed: true,
    verifiedBadge: false,
    analyticsAccess: true,
    adFreeExperience: true,
  },
  pro: {
    maxGiftPostsPerMonth: -1, // -1 means unlimited
    maxLiveStreamsPerMonth: -1,
    maxStreamDurationMinutes: 180,
    maxStoryClaimsPerDay: -1,
    priorityInDiscoverFeed: true,
    verifiedBadge: true,
    analyticsAccess: true,
    adFreeExperience: true,
  },
} as const;
