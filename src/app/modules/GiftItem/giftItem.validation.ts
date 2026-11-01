import { z } from 'zod';
import {
  GIFT_CATEGORY,
  GIFT_CONDITION,
  GIFT_VERIFICATION_STATUS,
} from './giftItem.constants';

const locationSchema = z.object({
  address: z.string().min(1, 'Pickup address is required'),
  location: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z
      .tuple([
        z.number().min(-180).max(180), // Longitude
        z.number().min(-90).max(90),   // Latitude
      ])
      .default([0, 0]),
  }),
});

const createGiftItemSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(120),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
    condition: z.enum(Object.values(GIFT_CONDITION) as [string, ...string[]]),
    category: z.enum(Object.values(GIFT_CATEGORY) as [string, ...string[]]),
    estimatedValue: z.union([z.literal(12), z.literal(24), z.literal(48)]),
    pickUpPreference:z.string(),
    coverImageIndex: z.number().int().min(0).max(4).default(0),
    pickupAddress: locationSchema,
    pickupInstructions: z.string().max(500).optional(),
    pickupRadius: z.number().min(1).max(100).default(25),
    availableFrom: z.string().datetime().or(z.date()).optional(),
    availableUntil: z.string().datetime().or(z.date()).optional(),
    pickupWindowStart: z.string().optional(),
    pickupWindowEnd: z.string().optional(),
    specialInstructions: z.string().max(1000).optional(),
    isPublished: z.boolean().default(true),
  }),
});

const updateGiftItemSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(120).optional(),
    description: z.string().min(10).max(2000).optional(),
    condition: z.enum(Object.values(GIFT_CONDITION) as [string, ...string[]]).optional(),
    category: z.enum(Object.values(GIFT_CATEGORY) as [string, ...string[]]).optional(),
    estimatedValue: z.union([z.literal(12), z.literal(24), z.literal(48)]).optional(),
   pickUpPreference:z.string().optional(),
    coverImageIndex: z.number().int().min(0).max(4).optional(),
    pickupAddress: locationSchema.optional(),
    pickupInstructions: z.string().max(500).optional(),
    pickupRadius: z.number().min(1).max(100).optional(),
    availableFrom: z.string().datetime().or(z.date()).optional(),
    availableUntil: z.string().datetime().or(z.date()).optional(),
    pickupWindowStart: z.string().optional(),
    pickupWindowEnd: z.string().optional(),
    specialInstructions: z.string().max(1000).optional(),
    isPublished: z.boolean().optional(),
  }),
});

const reviewGiftItemSchema = z.object({
  body: z.object({
    action: z.enum([
      GIFT_VERIFICATION_STATUS.APPROVED,
      GIFT_VERIFICATION_STATUS.REJECTED,
      GIFT_VERIFICATION_STATUS.FLAGGED,
    ]),
    notes: z.string().max(500).optional(),
    rejectionReason: z.string().max(500).optional(),
  }),
});

export const GiftItemValidations = {
  createGiftItemSchema,
  updateGiftItemSchema,
  reviewGiftItemSchema,
};
