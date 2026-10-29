import { Schema, model, Query } from 'mongoose';
import { TGiftItem, GiftItemModel } from './giftItem.interface';
import {
  GIFT_CATEGORY,
  GIFT_CLAIM_STATE,
  GIFT_CONDITION,
  GIFT_VERIFICATION_STATUS,
} from './giftItem.constants';

const giftItemSchema = new Schema<TGiftItem>(
  {
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host user is required'],
    },

    // Step 1: Photos & Title
    title: {
      type: String,
      required: [true, 'Gift title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    images: {
      type: [String],
      required: [true, 'At least one photo is required'],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length >= 1 && v.length <= 5,
        message: 'Must upload between 1 and 5 images',
      },
    },
    coverImageIndex: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },

    // Step 2: Details & Condition
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    pickUpPreference:{
      type:String,
      required:[true,"need add pickup preference"]
    },
    condition: {
      type: String,
      enum: Object.values(GIFT_CONDITION),
      required: [true, 'Condition is required'],
    },
    category: {
      type: String,
      enum: Object.values(GIFT_CATEGORY),
      required: [true, 'Category is required'],
    },
    estimatedValue: {
      // hour count
      type: Number,
      enum:[12,24,48]
    },
    // Step 3: Location & Pickup
    pickupAddress: {
      address: { type: String, required: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: (v: number[]) => Array.isArray(v) && v.length === 2,
            message: 'Coordinates must be [longitude, latitude]',
          },
        },
      },
    },
    pickupInstructions: {
      type: String,
      default: '',
      maxlength: 500,
    },
    pickupRadius: {
      type: Number,
      default: 25,
      min: 1,
      max: 100,
    },

    // Step 4: Timing & Instructions
    availableFrom: {
      type: Date,
      required: [true, 'Available from date is required'],
    },
    availableUntil: {
      type: Date,
      default: null,
    },
    pickupWindowStart: {
      type: String,
      default: '',
    },
    pickupWindowEnd: {
      type: String,
      default: '',
    },
    specialInstructions: {
      type: String,
      default: '',
      maxlength: 1000,
    },

    // Step 5: Review & Publish
    verificationStatus: {
      type: String,
      enum: Object.values(GIFT_VERIFICATION_STATUS),
      default: GIFT_VERIFICATION_STATUS.APPROVED, // auto-approved or pending based on admin config
    },
    claimState: {
      type: String,
      enum: Object.values(GIFT_CLAIM_STATE),
      default: GIFT_CLAIM_STATE.AVAILABLE,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },

    // Claim Association
    claimedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    associatedStream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      default: null,
    },

    // Metrics
    viewCount: {
      type: Number,
      default: 0,
    },
    storyClaimCount: {
      type: Number,
      default: 0,
    },

    // Admin Review
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReviewedAt: {
      type: Date,
      default: null,
    },
    adminReviewNotes: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// High-performance compound indexes
giftItemSchema.index({ 'pickupAddress.location': '2dsphere' });
giftItemSchema.index({ claimState: 1, verificationStatus: 1, isPublished: 1, isDeleted: 1 });
giftItemSchema.index({ host: 1, isDeleted: 1, createdAt: -1 });
giftItemSchema.index({ category: 1, claimState: 1 });
giftItemSchema.index({ createdAt: -1, isPublished: 1 });

// Soft delete query filter
giftItemSchema.pre<Query<any, TGiftItem>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const GiftItem = model<TGiftItem, GiftItemModel>('GiftItem', giftItemSchema);
