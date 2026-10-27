import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

const createAdminDataSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Valid email is required' }),
    fullName: z
      .string()
      .min(1, { message: 'Full name is required' })
      .max(100, { message: 'Full name is too long' }),
  }),
});

export const forceTerminateStreamZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
  }),
  body: z.object({
    reason: z
      .string()
      .min(5, 'Termination reason must be at least 5 characters')
      .max(500, 'Termination reason cannot exceed 500 characters'),
  }),
});

export const muteHostZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
  }),
  body: z.object({
    reason: z
      .string()
      .min(3, 'Mute reason must be at least 3 characters')
      .max(300, 'Mute reason cannot exceed 300 characters'),
  }),
});

export const userModerationActionZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'User ID is required')
      .refine(objectIdValidator, { message: 'Invalid User ObjectId format' }),
  }),
  body: z.object({
    action: z.enum(['warn', 'suspend', 'ban', 'unban', 'lift_suspension']),
    reason: z
      .string()
      .min(5, 'Moderation reason must be at least 5 characters')
      .max(500, 'Moderation reason cannot exceed 500 characters'),
    suspensionDurationDays: z
      .number()
      .int()
      .min(1, 'Suspension duration must be at least 1 day')
      .max(365, 'Suspension duration cannot exceed 365 days')
      .optional(),
  }),
});

export const reviewStoryClaimZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Claim ID is required')
      .refine(objectIdValidator, { message: 'Invalid Claim ObjectId format' }),
  }),
  body: z.object({
    action: z.enum(['approve', 'flag', 'remove']),
    notes: z.string().max(500).optional().default(''),
  }),
});

export const mongoIdParamZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'ID parameter is required')
      .refine(objectIdValidator, { message: 'Invalid ObjectId format' }),
  }),
});

export const adminValidation = {
  createAdminDataSchema,
  forceTerminateStreamZodSchema,
  muteHostZodSchema,
  userModerationActionZodSchema,
  reviewStoryClaimZodSchema,
  mongoIdParamZodSchema,
};
