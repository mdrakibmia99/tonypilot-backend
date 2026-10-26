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


export const AddressValidationSchema = z.object({
  address: z.string().default(""),

  location: z
    .object({
      type: z.literal("Point").default("Point"),

      coordinates: z
        .tuple([
          z.number().min(-180).max(180), // Longitude
          z.number().min(-90).max(90), // Latitude
        ])
        .default([0, 0]),
    })
    .default({
      type: "Point",
      coordinates: [0, 0],
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
      address: AddressValidationSchema.optional(),

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
