import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidator = (val: string) => Types.ObjectId.isValid(val);

export const addSaveGiftZodSchema = z.object({
  body: z.object({
    giftItemId: z
      .string()
      .min(1, 'Gift item ID is required')
      .refine(objectIdValidator, {
        message: 'Invalid Gift Item ObjectId format',
      }),
  }),
});

export const removeSaveGiftZodSchema = z.object({
  params: z.object({
    giftItemId: z
      .string()
      .min(1, 'Gift item ID is required')
      .refine(objectIdValidator, {
        message: 'Invalid Gift Item ObjectId format',
      }),
  }),
});

export const SaveGiftValidation = {
  addSaveGiftZodSchema,
  removeSaveGiftZodSchema,
};
