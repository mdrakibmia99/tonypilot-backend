import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

export const createStoryClaimZodSchema = z.object({
  body: z.object({
    streamId: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
    storyStatement: z
      .string()
      .min(20, 'Story statement must be at least 20 characters')
      .max(3000, 'Story statement cannot exceed 3000 characters'),
  }),
});

export const voteStoryClaimZodSchema = z.object({
  params: z.object({
    LiveStoryClaim: z
      .string()
      .min(1, 'Claim ID is required')
      .refine(objectIdValidator, { message: 'Invalid Claim ObjectId format' }),
  }),
  body: z.object({
    voteType: z.enum(['upvote', 'downvote']),
  }),
});

export const claimIdParamZodSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, 'Claim ID is required')
      .refine(objectIdValidator, { message: 'Invalid Claim ObjectId format' }),
  }),
});

export const streamClaimsQueryZodSchema = z.object({
  params: z.object({
    streamId: z
      .string()
      .min(1, 'Stream ID is required')
      .refine(objectIdValidator, { message: 'Invalid Stream ObjectId format' }),
  }),
});
