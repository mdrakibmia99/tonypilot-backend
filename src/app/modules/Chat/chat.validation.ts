import { z } from 'zod';

const baseGroupChatSchema = z.object({
  name: z
    .string({
      error: 'Group name must be a string',
    })
    .min(2, { message: 'Group name must be at least 2 characters long' })
    .max(100, { message: 'Group name cannot exceed 100 characters' }),
  groupAvatar: z.string().url({ message: 'Avatar must be a valid URL' }).optional(),
});

const createSingleChatZodSchema = z.object({
  body: z.object({
    recipientId: z
      .string({
        error: 'Recipient ID is required',
      })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ObjectId format' }),
  }),
});

const createGroupChatZodSchema = z.object({
  body: baseGroupChatSchema.extend({
    participants: z
      .array(
        z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid participant ObjectId format' })
      )
      .min(2, { message: 'A group chat requires at least 2 other participants' }),
  }),
});

const updateGroupChatZodSchema = z.object({
  body: baseGroupChatSchema.partial(),
});

const groupMemberZodSchema = z.object({
  body: z.object({
    memberId: z
      .string({
        error: 'Member ID is required',
      })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Member ObjectId format' }),
  }),
});

export const ChatValidation = {
  createSingleChatZodSchema,
  createGroupChatZodSchema,
  updateGroupChatZodSchema,
  groupMemberZodSchema,
};
