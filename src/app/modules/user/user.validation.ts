import { z } from 'zod';
import { USER_ROLE } from './user.constants';

const userValidationSchema = z.object({
  body: z.object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
    email: z.string({ message: 'Invalid email address' }),
    fullName: z.string({ message: 'Full name is required' }),
    role: z.enum([USER_ROLE.USER]).optional(),
  }),
});
const userValidationForGoogleSchema = z.object({
  body: z.object({
    accessToken: z.string().nonempty({ message: 'Access Token is required!' }),
  }),
});









const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').optional(),
    about: z.string().optional(),
    phone: z
      .object({
        code: z.string().min(1, 'Phone code is required').optional(),
        number: z.string().min(6, 'Phone number is required').optional(),
      })
      .optional(),
    dob: z.string({ message: 'Date of birth is required' }).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
  }),
});
const completeProfileSchema = z.object({
  body: z.object({
    about: z.string({ message: 'About is required' }),
  }),
});

const fcmTokenValidationSchema = z.object({
  body: z.object({
    fcmToken: z.string().optional(),
  }),
})

export const userValidation = {
  userValidationSchema,
  completeProfileSchema,
  updateProfileSchema,
  userValidationForGoogleSchema,
  fcmTokenValidationSchema
};
