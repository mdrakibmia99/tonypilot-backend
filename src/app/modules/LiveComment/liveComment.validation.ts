import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

export const createLiveCommentZodSchema = z.object({
  body: z.object({
    streamId: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
    message: z
      .string()
      .min(1, 'Comment message cannot be empty')
      .max(500, 'Comment cannot exceed 500 characters'),
    commentType: z
      .enum(['text', 'emoji_reaction', 'system'])
      .optional()
      .default('text'),
  }),
});

export const commentIdParamZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Comment ID is required')
      .refine(objectIdValidator, { message: 'Invalid Comment ObjectId format' }),
  }),
});

export const streamCommentsQueryZodSchema = z.object({
  params: z.object({
    streamId: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
  }),
});

export const createModerationReportZodSchema = z.object({
  body: z.object({
    targetType: z.enum([
      'live_comment',
      'story_claim',
      'gift_item',
      'user',
      'live_stream',
    ]),
    targetId: z
      .string()
      .min(1, 'Target ID is required')
      .refine(objectIdValidator, { message: 'Invalid Target ObjectId format' }),
    reasonCode: z.enum([
      'inappropriate_content',
      'spam',
      'harassment',
      'hate_speech',
      'scam_fraud',
      'misleading_info',
      'violence',
      'other',
    ]),
    reasonText: z
      .string()
      .max(1000, 'Reason detail cannot exceed 1000 characters')
      .optional()
      .default(''),
  }),
});
