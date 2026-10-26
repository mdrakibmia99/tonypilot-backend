import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

export const preLiveInitZodSchema = z.object({
  body: z.object({
    giftItemId: z
      .string()
      .min(1, 'Gift item ID is required to host a live stream')
      .refine(objectIdValidator, { message: 'Invalid GiftItem ObjectId format' }),
    channelName: z
      .string()
      .min(3, 'Channel name must be at least 3 characters')
      .max(100, 'Channel name cannot exceed 100 characters'),
    timerDurationSeconds: z
      .number()
      .int()
      .min(60, 'Minimum live stream timer is 60 seconds')
      .max(10800, 'Maximum live stream timer is 3 hours (10,800 seconds)')
      .default(900),
  }),
});

export const streamIdParamZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Stream ID param is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
  }),
});

export const zegoWebhookZodSchema = z.object({
  body: z.object({
    event: z.string(),
    stream_id: z.string().optional(),
    room_id: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    nonce: z.union([z.string(), z.number()]).optional(),
    signature: z.string().optional(),
  }),
});
