import { z } from "zod";

// 1) Inner payload schema (data)
const createAdminDataSchema = z.object({
    body: z.object({
        email: z.string().email({ message: "Valid email is required" }),
        fullName: z
            .string()
            .min(1, { message: "Full name is required" })
            .max(100, { message: "Full name is too long" })
    }),
});

export const adminValidation = {
    createAdminDataSchema
}