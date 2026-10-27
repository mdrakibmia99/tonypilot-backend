/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Model, Types } from 'mongoose';
import {
  TBillingCycle,
  TSubscriptionStatus,
  TSubscriptionTier,
} from './subscription.constants';

export interface TSubscriptionPlanFeatures {
  maxGiftPostsPerMonth: number;
  maxLiveStreamsPerMonth: number;
  maxStreamDurationMinutes: number;
  maxStoryClaimsPerDay: number;
  priorityInDiscoverFeed: boolean;
  verifiedBadge: boolean;
  analyticsAccess: boolean;
  adFreeExperience: boolean;
}

export interface TSubscriptionPlan {
  _id?: Types.ObjectId | string;
  tier: TSubscriptionTier;
  name: string;
  description: string;
  billingCycle: TBillingCycle;
  priceInCents: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  features: TSubscriptionPlanFeatures;
  isActive: boolean;
  sortOrder: number;
  trialDays: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export type SubscriptionPlanModel = Model<TSubscriptionPlan>;

export interface TUserSubscription {
  _id?: Types.ObjectId | string;
  user: Types.ObjectId;
  plan: Types.ObjectId;
  tier: TSubscriptionTier;
  status: TSubscriptionStatus;

  // Stripe references
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeLatestInvoiceId?: string;

  // Auto-renewal tracking
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;

  // Billing
  billingCycle: TBillingCycle;
  priceInCents: number;
  currency: string;

  // Dates
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  canceledAt?: Date | null;
  cancelReason?: string;

  // Webhook audit
  lastWebhookEvent?: string;
  lastWebhookAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type UserSubscriptionModel = Model<TUserSubscription>;

export type TransactionType = 'subscription_payment' | 'subscription_refund' | 'one_time';
export type TransactionStatus = 'succeeded' | 'failed' | 'pending' | 'refunded';

export interface TPaymentTransaction {
  _id?: Types.ObjectId | string;
  user: Types.ObjectId;
  subscription?: Types.ObjectId;
  stripePaymentIntentId: string;
  stripeInvoiceId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amountInCents: number;
  currency: string;
  description: string;
  failureReason?: string;
  metadata?: Record<string, string>;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentTransactionModel extends Model<TPaymentTransaction> {}

export interface TSavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  cardholderName?: string;
}
