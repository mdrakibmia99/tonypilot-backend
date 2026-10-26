import bcrypt from 'bcrypt';
import { Error, model, Query, Schema } from 'mongoose';
import config from '../../config';
import { TUser, UserModel } from './user.interface';
import { gender, GENDER_ENUM, USER_ROLE, USER_ROLE_ENUM } from './user.constants';
import { LOGIN_WITH, LOGIN_WITH_ENUM } from '../auth/auth.constant';
import { AddressSchema } from '../../utils/locationWithLatLan';


const userSchema = new Schema<TUser>(
  {
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      unique: [true, 'Email already exists'],
    },

    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLE_ENUM,
      required: true,
      default: USER_ROLE.USER,
    },
    address: {
      type: AddressSchema,
    },

    // common fields for all users
    fullName: {
      type: String,
      default: 'New User',
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: GENDER_ENUM,
      default: gender.NO
    },

    phone: {
      code: {
        type: String,
        default: '',
      },
      number: {
        type: String,
        default: '',
      },
      fullNumber: {
        type: String,
        default: '',
      }
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    about: {
      type: String,
    },


    isBlocked: {
      type: Boolean,
      default: false,
    },
    isVerifiedByAdmin: {
      type: Boolean,
      default: true,
    },
    hasCompletedProfile: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    loginWth: {
      type: String,
      enum: LOGIN_WITH_ENUM,
      default: LOGIN_WITH.CREDENTIALS,
    },

    fcmToken: { type: String, default: null },
    subscriptionTier: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free',
    },
    activeSubscription: {
      type: Schema.Types.ObjectId,
      ref: 'UserSubscription',
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspendedUntil: {
      type: Date,
      default: null,
    },
    totalGiftsGiven: { type: Number, default: 0 },
    totalGiftsReceived: { type: Number, default: 0 },
    totalStreamsHosted: { type: Number, default: 0 },
    totalStoriesClaimed: { type: Number, default: 0 },
    neighborhoodLabel: { type: String, default: '' },
    communityTrustScore: { type: Number, default: 50, min: 0, max: 100 },
    agreedToRules: { type: Boolean, default: false },
    agreedToRulesAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);



// =======================
// USER SEARCH INDEXES
// =======================
userSchema.index({
  role: 1,
  isBlocked: 1,
  isDeleted: 1,
});
userSchema.index({ subscriptionTier: 1, isBlocked: 1, isDeleted: 1 });
userSchema.index({ stripeCustomerId: 1 });
userSchema.index({ isSuspended: 1, suspendedUntil: 1
});










userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, Number(config.bcrypt_salt_rounds));
    // Update passwordChangedAt when password is modified
    user.passwordChangedAt = new Date();
  }
  next();
});

// set '' after saving password
userSchema.post(
  'save',
  function (error: Error, doc: any, next: (error?: Error) => void): void {
    doc.password = '';
    next();
  },
);

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password; // Remove password field
  // Convert DOB to YYYY-MM-DD string
  if (user.dateOfBirth instanceof Date) {
    user.dateOfBirth = user.dateOfBirth.toISOString().split("T")[0];
  }

  // Convert createdAt / updatedAt to ISO string
  if (user.createdAt instanceof Date) {
    user.createdAt = user.createdAt.toISOString();
  }
  if (user.updatedAt instanceof Date) {
    user.updatedAt = user.updatedAt.toISOString();
  }
  return user;
};

// filter out deleted documents
userSchema.pre<Query<any, TUser>>(/^find/, function (next) {
  // 'this' is now typed as a Mongoose Query
  const query = this;

  // Bypass soft-delete filter if ignoreDeleted is set
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }

  next();
});

// userSchema.pre('findOne', function (next) {
//   this.find({ isDeleted: { $ne: true } });
//   next();
// });

userSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

userSchema.statics.isUserExist = async function (email: string) {
  return await User.findOne({ email: email }).select('+password');
};

userSchema.statics.isUserActive = async function (email: string) {
  return await User.findOne({
    email: email,
    isBlocked: false,
    isDeleted: false,
  }).select('+password');
};

userSchema.statics.IsUserExistById = async function (id: string) {
  return await User.findById(id).select('+password');
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword,
  hashedPassword,
) {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};

export const User = model<TUser, UserModel>('User', userSchema);














