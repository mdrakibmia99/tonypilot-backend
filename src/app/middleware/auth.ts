import httpStatus from 'http-status';
import AppError from '../error/AppError';
import catchAsync from '../utils/catchAsync';
import { verifyToken } from '../utils/tokenManage';
import config from '../config';
import { User } from '../modules/user/user.models';
import { USER_ROLE } from '../modules/user/user.constants';

const auth = (...allowedRoles: string[]) => {
  return catchAsync(async (req, res, next) => {
    const token: string | undefined =
      req.headers?.authorization?.split(' ')[1] || req.headers?.token as string;
    console.log('Auth Middleware');
    if (!token) {
      if (allowedRoles.length && allowedRoles.includes(USER_ROLE.OPTIONAL)) {
        return next();
        // return;
      } else {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!')
      };

    }

    // Verify JWT
    const decoded: any = verifyToken({
      token,
      access_secret: config.jwt_access_secret as string,
    });

    if (!decoded) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token!');
    }

    const user = await User.IsUserExistById(decoded.userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.role !== decoded.role) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!.');
    }

    // Check if user changed password after token was issued
    if (user.passwordChangedAt) {
      const passwordChangedAt = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < passwordChangedAt) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'Password recently changed. Please login again.'
        );
      }
    }

    if (user.isVerifiedByAdmin === false) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Your account is not verified by admin yet. Please contact to admin.');
    }
    if (user.isBlocked) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Your account is blocked. Please contact to admin.');
    }

    // Check user role
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      console.log('allowedRoles', allowedRoles, user.role);
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
    }

    // update user active status and last active time
    const now = new Date();
      const last = user.lastActiveAt ? new Date(user.lastActiveAt) : new Date(0);

      const diff = (now.getTime() - last.getTime()) / 1000; // seconds

      if (diff > 600) { // 5 minutes
        await User.findByIdAndUpdate(user.id, {
          lastActiveAt: now,
        });
      }

    req.user = decoded;
    next();
  });
};
export const authForCompleteProfile = (...allowedRoles: string[]) => {
  return catchAsync(async (req, res, next) => {
    const token: string | undefined =
      req.headers?.authorization?.split(' ')[1] || req.headers?.token as string;
    console.log('Auth Middleware');
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    // Verify JWT
    const decoded: any = verifyToken({
      token,
      access_secret: config.jwt_access_secret as string,
    });

    if (!decoded) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token!');
    }

    const user = await User.IsUserExistById(decoded.userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.role !== decoded.role) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!.');
    }
    // if( user.hasCompletedProfile){
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Your profile is already completed.');
    // }

    // Check if user changed password after token was issued
    if (user.passwordChangedAt) {
      const passwordChangedAt = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < passwordChangedAt) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'Password recently changed. Please login again.'
        );
      }
    }
    // if (user.isVerifiedByAdmin === false) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Your account is not verified by admin yet. Please contact to admin.');
    // }

    // Check user role
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
    }

    req.user = decoded;
    next();
  });
};

export default auth;
