import { z } from "zod";

const updateSettingValidationSchema = z.object({
  body: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
  })
});

export const settingValidation = {
  updateSettingValidationSchema,
};
