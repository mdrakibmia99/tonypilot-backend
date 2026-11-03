/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Types, Model } from 'mongoose';

export type TGiftCondition = 'new' | 'like_new' | 'good' | 'fair' | 'worn';
export type TGiftVerificationStatus = 'pending_review' | 'approved' | 'rejected' | 'flagged';
export type TGiftClaimState = 'available' | 'claimed' | 'pickup_arranged' | 'delivered' | 'expired';
export type TGiftCategory =
  | 'electronics'
  | 'furniture'
  | 'clothing'
  | 'toys'
  | 'books'
  | 'kitchen'
  | 'sports'
  | 'home_decor'
  | 'tools'
  | 'other';

export interface TGiftItem {
  _id?: Types.ObjectId | string;
  host: Types.ObjectId;
  estimateTime: Date;

  // Step 1: Photos & Title
  title: string;
  images: string[];
  coverImageIndex: number;

  // Step 2: Details & Condition
  description: string;
  condition: TGiftCondition;
  category: TGiftCategory;
  estimatedValue: 12 | 24 | 48;
  tags: string[];
  pickUpPreference:string

  // Step 3: Location & Pickup
  pickupAddress: {
    address: string;
    location: {
      type: 'Point';
      coordinates: [number, number]; // [longitude, latitude]
    };
  };
  pickupInstructions?: string;
  pickupRadius?: number;

  // Step 4: Timing & Instructions
  availableFrom: Date;
  availableUntil?: Date;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  specialInstructions?: string;

  // Step 5: Review & Publish
  verificationStatus: TGiftVerificationStatus;
  claimState: TGiftClaimState;
  sportLite?: boolean;
  isPublished: boolean;
  publishedAt?: Date | null;

  // Claim & Association
  claimedBy?: Types.ObjectId | null;
  claimedAt?: Date | null;
  associatedStream?: Types.ObjectId | null;

  // Metrics
  viewCount: number;
  storyClaimCount: number;

  // Admin
  adminReviewedBy?: Types.ObjectId | null;
  adminReviewedAt?: Date | null;
  adminReviewNotes?: string;
  rejectionReason?: string;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface GiftItemModel extends Model<TGiftItem> {}
