import { z } from 'zod';

const attachmentZodSchema = z.object({
  url: z.string(),
  fileType: z.string().min(1, { message: 'File type is required' }),
  name: z.string().optional(),
  size: z.number().positive().optional(),
});

const baseMessageSchema = z.object({
  content: z.string().max(5000, { message: 'Message content cannot exceed 5000 characters' }).default(''),
  attachments: z.array(attachmentZodSchema).optional().default([]),
});

const sendMessageZodSchema = z.object({
  body: baseMessageSchema
    .extend({
      chatId: z
        .string({
          error: 'Chat ID is required',
        })
        .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Chat ObjectId format' }),
    })
    .refine((data) => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0), {
      message: 'A message must contain either text content or at least one attachment',
    }),
});

const updateMessageZodSchema = z.object({
  body: baseMessageSchema.partial(),
});

export const MessageValidation = {
  sendMessageZodSchema,
  updateMessageZodSchema,
};
