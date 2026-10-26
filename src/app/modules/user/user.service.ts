/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { DeleteAccountPayload, IUserValidationForGoogle, TUser, TUserCreate } from './user.interface';
import { User } from './user.models';
import config from '../../config';
import QueryBuilder from '../../builder/QueryBuilder';
import { otpServices } from '../otp/otp.service';
import { generateOptAndExpireTime } from '../otp/otp.utils';
import { TPurposeType, TReceiverType } from '../otp/otp.interface';
import { otpSendEmail } from '../../utils/emailNotification';
import { createToken, verifyToken } from '../../utils/tokenManage';
import { USER_ROLE } from './user.constants';
import { IJwtPayload } from '../auth/auth.interface';
import { generateAndReturnTokens, verifyAppleToken, verifyGoogleToken } from '../auth/auth.utils';
import { RedisService, cacheService, cacheKeys, CACHE_TTL } from '../../redis';

import { LOGIN_WITH } from '../auth/auth.constant';


export type IFilter = {
  searchTerm?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface OTPVerifyAndCreateUserProps {
  otp: string;
  token: string;
}

const createUserToken = async (payload: TUserCreate) => {
  console.log('Payload received in user token service');

  const { email, fullName, password } = payload;


  // Check if user already exists
  const userExist = await User.findOne({ email }).setOptions({ ignoreDeleted: true });
  if (userExist) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User already exist!!');
  }

  // Check existing OTP status
  const { isExist, isExpireOtp } = await otpServices.checkOtpByEmail(email);
  const { otp, expiredAt } = generateOptAndExpireTime();

  if (isExist && !isExpireOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'OTP already sent. Please check your email.',
    );
  }


  const otpPayload = {
    sentTo: email,
    receiverType: 'email' as TReceiverType,
    purpose: 'email-verification' as TPurposeType,
    otp,
    expiredAt,
  };

  // Create or update OTP
  if (isExist && isExpireOtp) {
    await otpServices.updateOtpByEmail(email, {
      otp,
      expiredAt,
    });
  } else if (!isExist) {
    await otpServices.createOtp(otpPayload);
  }
  console.log('OTP payload prepared1:', otpPayload, otp);
  // Send OTP email
  await otpSendEmail({
    sentTo: email,
    subject: 'Your one-time OTP for email verification',
    otp,
  });
  console.log('OTP payload prepared2:', otpPayload, otp);



  // Create token containing user data for later verification
  const tokenPayload: Partial<TUserCreate> = {
    email,
    password,
    fullName
  };
  console.log('Token payload:', tokenPayload);
  const token = createToken({
    payload: tokenPayload,
    access_secret: config.create_user_secret as string,
    expity_time: config.create_user_expire_time as string | number,
  });

  return token;
};



const otpVerifyAndCreateUser = async ({
  otp,
  token,
}: OTPVerifyAndCreateUserProps) => {
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token not found');
  }

  const decodeData = verifyToken({
    token,
    access_secret: config.create_user_secret as string,
  });

  if (!decodeData) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You are not authorized');
  }

  const { password, email, fullName } = decodeData as any;
  console.log('decodeData', decodeData);
  // Check OTP match
  const isOtpValid = await otpServices.otpMatch(email, otp);

  if (!isOtpValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OTP');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email }).setOptions({ ignoreDeleted: true });
  if (existingUser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'A user already exists with this email',
    );
  }
  const userData = {
    email,
    password,
    fullName
  }
  // Create user
  const newUser = await User.create(userData);
  if (!newUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'User creation failed',
    );
  }

  // Update OTP status
  await otpServices.updateOtpByEmail(email, { status: 'verified' });

  return generateAndReturnTokens(newUser);
};



const createOrLoginUserWithGoogle = async (payload: IUserValidationForGoogle) => {
  const { accessToken } = payload;

  console.log("payload======>", payload);
  const googleUser = await verifyGoogleToken(accessToken);
  console.log("googleUser======>", googleUser);

  // if (!googleUser) throw new AppError(httpStatus.FORBIDDEN, 'User not found');
  // let user = await User.findOne({ googleId: googleUser.sub }).setOptions({ overrideDeletedFilter: true });
  let user = await User.findOne({ email: googleUser.email }).setOptions({ ignoreDeleted: true });

  if (user) {
    // login login here
    return generateAndReturnTokens(user);
  }


  const email = googleUser.email;

  const userData = {
    fullName: googleUser.name || "New User",
    email,
    password: googleUser.googleId,
    loginWth: LOGIN_WITH.GOOGLE
  }

  // Create user
  const newUser = await User.create(userData);
  if (!newUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'User creation failed',
    );
  }

  // Update OTP status
  // await otpServices.updateOtpByEmail(email, { status: 'verified' });

  return generateAndReturnTokens(newUser);
}
const createOrLoginUserWithApple = async (payload: IUserValidationForGoogle) => {
  const { accessToken } = payload;

  const appleUser = await verifyAppleToken(accessToken);
  let user = await User.findOne({ appleId: appleUser.appleId }).setOptions({ ignoreDeleted: true });

  if (user) {
    // login login here
    return generateAndReturnTokens(user);
  }
  const checkExistingUser = await User.findOne({ email: appleUser.email }).setOptions({ ignoreDeleted: true });
  console.log('checkExistingUser', checkExistingUser);
  if (checkExistingUser ) {
    throw new AppError(httpStatus.BAD_REQUEST,`You are already registered with ${checkExistingUser.loginWth === LOGIN_WITH.GOOGLE ? 'Google' : 'Apple'}. Please login with ${checkExistingUser.loginWth === LOGIN_WITH.GOOGLE ? 'Google' : 'Apple'} to continue.`);
  }

  
  const email = appleUser.email;

  const userData = {
    appleId: appleUser.appleId,
    fullName: appleUser?.name || "New User",
    email,
    password: appleUser.appleId,
    loginWth: LOGIN_WITH.APPLE
  }

  // Create user
  const newUser = await User.create(userData);
  if (!newUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'User creation failed',
    );
  }

  // Update OTP status
  // await otpServices.updateOtpByEmail(email, { status: 'verified' });

  return generateAndReturnTokens(newUser);
}







// ............................rest

const getAllUserQuery = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  // Build cache key based on query parameters
  const queryHash = JSON.stringify(query);
  const cacheKey = `users:list:${userId}:${queryHash}`;

  // 1. Check Redis cache first
  const cachedUsers = await RedisService.get<{ meta: any; result: any }>(cacheKey);
  if (cachedUsers) {
    return cachedUsers;
  }

  // 2. Cache miss: Fetch from MongoDB using lean() for maximum performance
  const userQuery = new QueryBuilder(User.find({ _id: { $ne: userId } }).lean(), query)
    .search(['fullName'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  const responseData = { meta, result };

  // 3. Store in Redis with TTL (300 seconds / 5 minutes)
  await RedisService.set(cacheKey, responseData, 300);

  return responseData;
};

const getAllUserCount = async () => {
  const allUserCount = await User.countDocuments();
  return allUserCount;
};

const getUsersOverview = async (userId: string, year: any) => {
  const cacheKey = cacheKeys.usersOverview(year);

  return await cacheService.getOrSet(
    cacheKey,
    async () => {
      // Fetch total user count
      const totalUsers = await User.countDocuments();

      // Fetch user growth over time for the specified year (monthly count with month name)
      const userOverview = await User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(`${year}-01-01`),
              $lt: new Date(`${year + 1}-01-01`),
            }, // Filter by year
          },
        },
        {
          $group: {
            _id: { $month: '$createdAt' }, // Group by month of the 'createdAt' date
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            monthName: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id', 1] }, then: 'January' },
                  { case: { $eq: ['$_id', 2] }, then: 'February' },
                  { case: { $eq: ['$_id', 3] }, then: 'March' },
                  { case: { $eq: ['$_id', 4] }, then: 'April' },
                  { case: { $eq: ['$_id', 5] }, then: 'May' },
                  { case: { $eq: ['$_id', 6] }, then: 'June' },
                  { case: { $eq: ['$_id', 7] }, then: 'July' },
                  { case: { $eq: ['$_id', 8] }, then: 'August' },
                  { case: { $eq: ['$_id', 9] }, then: 'September' },
                  { case: { $eq: ['$_id', 10] }, then: 'October' },
                  { case: { $eq: ['$_id', 11] }, then: 'November' },
                  { case: { $eq: ['$_id', 12] }, then: 'December' },
                ],
                default: 'Unknown', // Default value in case month is not valid
              },
            },
          },
        },
        { $sort: { _id: 1 } }, // Sort by month (ascending)
      ]);

      // Fetch recent users
      const recentUsers = await User.find({ _id: { $ne: userId } })
        .sort({ createdAt: -1 })
        .limit(6);

      return {
        totalUsers,
        userOverview, // Includes month names with user counts
        recentUsers,
      };
    },
    CACHE_TTL.ONE_HOUR // 1 hour TTL
  );
};

const getUserById = async (id: string) => {
  const cacheKey = `user:${id}:detail`;

  // 1. Check Redis cache first
  const cachedUser = await RedisService.get(cacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  // 2. Cache miss: Fetch from MongoDB using lean()
  const user = await User.findById(id).lean();
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // 3. Set to Redis with TTL (300 seconds)
  await RedisService.set(cacheKey, user, 300);

  // 4. Return the fresh result
  return user;
};

// Optimized the function with Redis caching (Configurable TTL: 10 minutes)
const getMyProfile = async (id: string, fields?: string) => {
  // ✅ Default fields to include when no 'fields' query param is provided
  const defaultFields = ['dob', 'gender', 'phone', 'address', 'profileImage', 'bio', 'role', 'email', 'fullName','address', 'isPhoneVerified', 'about', 'subscriptionExpiresAt', 'scriptGeneratedCount'];

  // ✅ Determine which fields to select
  const selectFields = fields
    ? fields.split(',').map(f => f.trim()).join(' ') // if fields provided, use only them
    : defaultFields.join(' '); // otherwise, use defaults

  const cacheKey = cacheKeys.userProfile(id, fields);

  return await cacheService.getOrSet(
    cacheKey,
    async () => {
      // ✅ Fetch user data from the database
      const userData = await User.findById(id).select(selectFields);

      if (!userData) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
      }

      return userData;
    },
    CACHE_TTL.TEN_MINUTES // 10 minutes TTL
  );
};


const completeMyProfile = async (userId: string, payload: Partial<TUser>) => {
  console.log('payload===>complete profile', payload);

  const profileData={...payload,hasCompletedProfile: true}
  console.log('profileData ===>', profileData,userId);
  const updateProfile = await User.findByIdAndUpdate(
    userId,
    { $set:  profileData},
    { new: true, runValidators: true }
  );
  console.log('updateProfile==> status', updateProfile);
  if (!updateProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // ✅ Auto-delete cached profile & user lists whenever data changes
  await Promise.all([
    cacheService.delByPattern(cacheKeys.userPattern(userId)),
    cacheService.delByPattern(cacheKeys.usersAllPattern()),
  ]);

  console.log('updateProfile', updateProfile);
  return updateProfile;
};

const updateMyProfile = async (userId: string, payload: Partial<TUser>) => {
  const updateProfile = await User.findByIdAndUpdate(
    userId,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();
  if (!updateProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // ✅ Auto-delete cached profile & user lists whenever data changes
  await Promise.all([
    cacheService.delByPattern(cacheKeys.userPattern(userId)),
    cacheService.delByPattern(cacheKeys.usersAllPattern()),
  ]);

  const token= generateAndReturnTokens(updateProfile);
  return {...updateProfile,accessToken:token.accessToken};
};

const deleteMyAccount = async (id: string, payload: DeleteAccountPayload) => {
  const user: TUser | null = await User.IsUserExistById(id);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  if (!(await User.isPasswordMatched(payload.password, user.password))) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password does not match');
  }

  const userDeleted = await User.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );

  if (!userDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'user deleting failed');
  }

  // ✅ Auto-delete cached profile upon deletion
  await Promise.all([
    cacheService.delByPattern(cacheKeys.userPattern(id)),
    cacheService.delByPattern(cacheKeys.usersAllPattern()),
  ]);

  return userDeleted;
};



const getUserProfile = async (userId: string) => {
  const cacheKey = cacheKeys.userProfile(userId);
  return await cacheService.getOrSet(
    cacheKey,
    async () => {
      const profile = await User.findById(userId).lean();
      if (!profile) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
      }
      return profile;
    },
    CACHE_TTL.TEN_MINUTES
  );
};
const checkVerifiedStatus = async (token: any) => {
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token not found');
  }

  try {
    const decoded = verifyToken({
      token,
      access_secret: config.jwt_access_secret as string,
    });

    if (!decoded) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token!');
    }
    const userId = (decoded as IJwtPayload).userId;
    const user = await User.findById(
      userId
    ).setOptions({ ignoreDeleted: true });

    if (!user) {
      return { isVerifiedByAdmin: false };
    }
    const tokenData = generateAndReturnTokens(user);
    return tokenData;
    // return {
    //   isVerifiedByAdmin: user.isVerifiedByAdmin, ...(user.isVerifiedByAdmin && { token: tokenData.accessToken })
    // };
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token!');
  }

};


const fcmTokenSetOrRemove = async (
  userId: string,
  fcmToken: string,
  status: string
) => {


  const updateValue = status === 'set' ? fcmToken : '';
console.log('updateValue', updateValue, 'userId', userId, 'status', status);
  const result = await User.findByIdAndUpdate(
    userId,
    { $set: { fcmToken: updateValue } },
    { new: true }
  );

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return null;
};
export const userService = {
  createUserToken,
  otpVerifyAndCreateUser,
  getMyProfile,
  updateMyProfile,
  // updateMyProfile2,
  getUserById,
  completeMyProfile,
  deleteMyAccount,
  getAllUserQuery,
  getAllUserCount,
  getUsersOverview,
  getUserProfile,
  checkVerifiedStatus,
  createOrLoginUserWithGoogle,
  createOrLoginUserWithApple,
  fcmTokenSetOrRemove
};

export const UserService = userService;

