import { Schema, model } from 'mongoose';
import {
  TSubscriptionPlan,
  SubscriptionPlanModel,
  TUserSubscription,
  UserSubscriptionModel,
  TPaymentTransaction,
  PaymentTransactionModel,
} from './subscription.interface';
import {
  BILLING_CYCLE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TIER,
} from './subscription.constants';

// ==========================================
// 1. SUBSCRIPTION PLAN SCHEMA
// ==========================================
const subscriptionPlanFeaturesSchema = new Schema(
  {
    maxGiftPostsPerMonth: { type: Number, required: true },
    maxLiveStreamsPerMonth: { type: Number, required: true },
    maxStreamDurationMinutes: { type: Number, required: true },
    maxStoryClaimsPerDay: { type: Number, required: true },
    priorityInDiscoverFeed: { type: Boolean, default: false },
    verifiedBadge: { type: Boolean, default: false },
    analyticsAccess: { type: Boolean, default: false },
    adFreeExperience: { type: Boolean, default: false },
  },
  { _id: false }
);

const subscriptionPlanSchema = new Schema<TSubscriptionPlan>(
  {
    tier: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TIER),
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BILLING_CYCLE),
      required: true,
    },
    priceInCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
      lowercase: true,
    },
    stripePriceId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeProductId: {
      type: String,
      required: true,
    },
    features: {
      type: subscriptionPlanFeaturesSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ tier: 1, billingCycle: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const SubscriptionPlan = model<TSubscriptionPlan, SubscriptionPlanModel>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

// ==========================================
// 2. USER SUBSCRIPTION SCHEMA
// ==========================================
const userSubscriptionSchema = new Schema<TUserSubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    tier: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TIER),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      required: true,
      default: SUBSCRIPTION_STATUS.INCOMPLETE,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
    },
    stripeLatestInvoiceId: {
      type: String,
      default: '',
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BILLING_CYCLE),
      required: true,
    },
    priceInCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    lastWebhookEvent: { type: String, default: '' },
    lastWebhookAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });
userSubscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });

export const UserSubscription = model<TUserSubscription, UserSubscriptionModel>(
  'UserSubscription',
  userSubscriptionSchema
);

// ==========================================
// 3. PAYMENT TRANSACTION SCHEMA
// ==========================================
const paymentTransactionSchema = new Schema<TPaymentTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'UserSubscription',
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
    },
    stripeInvoiceId: { type: String, default: '' },
    type: {
      type: String,
      enum: ['subscription_payment', 'subscription_refund', 'one_time'],
      required: true,
    },
    status: {
      type: String,
      enum: ['succeeded', 'failed', 'pending', 'refunded'],
      required: true,
    },
    amountInCents: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    description: {
      type: String,
      required: true,
    },
    failureReason: { type: String, default: '' },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ user: 1, createdAt: -1 });
paymentTransactionSchema.index({ stripePaymentIntentId: 1 }, { unique: true });
paymentTransactionSchema.index({ status: 1, type: 1 });

export const PaymentTransaction = model<TPaymentTransaction, PaymentTransactionModel>(
  'PaymentTransaction',
  paymentTransactionSchema
);
