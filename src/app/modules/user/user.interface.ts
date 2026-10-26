import { HydratedDocument, Model, Types } from 'mongoose';
import { IAddress } from '../../interface/common.interface';
import { LOGIN_WITH_INTERFACE } from '../auth/auth.constant';
import { GENDER_INTERFACE, USER_ROLE, USER_ROLE_INTERFACE } from './user.constants';

export interface TUser {
  _id?: Types.ObjectId | string;
  appleId?: string;
  email: string;
  password: string;
  role: USER_ROLE_INTERFACE;
  address?: IAddress;

  // common fields for all users
  fullName?: string;
  dob?: Date;
  gender?: GENDER_INTERFACE;

  phone?: {
    code?: string;
    number?: string;
    fullNumber: string;
  };
 isPhoneVerified?: boolean;
  profileImage?: string;
  about?: string;

  // status flags
  isBlocked?: boolean;
  isVerifiedByAdmin?: boolean;
  hasCompletedProfile?: boolean;
  isDeleted?: boolean;

  passwordChangedAt?: Date | null;
  loginWth?: LOGIN_WITH_INTERFACE;
  fcmToken?: string | null;

  lastActiveAt?: Date;

  // Optional AI / Subscription fields
  subscriptionExpiresAt?: Date | null;
  scriptGeneratedCount?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface TUserCreate {
  email: string;
  password: string;
  fullName?: string;
  role?: USER_ROLE_INTERFACE;
  appleId?: string;
  address?: IAddress;
  dob?: Date;
  gender?: GENDER_INTERFACE;
  phone?: {
    code?: string;
    number?: string;
    fullNumber: string;
  };
  profileImage?: string;
  about?: string;
  isBlocked?: boolean;
  isVerifiedByAdmin?: boolean;
  hasCompletedProfile?: boolean;
  isDeleted?: boolean;
  passwordChangedAt?: Date | null;
  loginWth?: LOGIN_WITH_INTERFACE;
  fcmToken?: string | null;
  lastActiveAt?: Date;
  subscriptionExpiresAt?: Date | null;
  scriptGeneratedCount?: number;
}

export interface DeleteAccountPayload {
  password: string;
}

export interface IUserValidationForGoogle {
  accessToken: string;
  role?: typeof USER_ROLE.USER;
  isOrganizationProfile?: boolean;
}

export interface UserModel extends Model<TUser> {
  isUserExist(email: string): Promise<TUser | null>;
  isUserActive(email: string): Promise<TUser | null>;
  IsUserExistById(id: string): Promise<HydratedDocument<TUser> | null>;
  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
}

export type IPaginationOption = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
