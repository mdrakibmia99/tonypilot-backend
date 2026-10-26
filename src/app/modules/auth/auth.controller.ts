import catchAsync from '../../utils/catchAsync';
import { Request, Response } from 'express';
import { authServices } from './auth.service';
import sendResponse from '../../utils/sendResponse';
import config from '../../config';
import httpStatus from 'http-status';
import AppError from '../../error/AppError';



// login
const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.login(req.body);
  const cookieOptions: any = {
    secure: false,
    httpOnly: true,
    maxAge: 31536000000,
  };

  if (config.NODE_ENV !== 'development') {
    cookieOptions.sameSite = 'none';
  }
  res.cookie('refreshToken', result.refreshToken, {
    secure: config.NODE_ENV !== 'development',
    // httpOnly: true,
    // sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged in successfully',
    data: result,
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {

  const result = await authServices.googleLogin(req.body.accessToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Google logged in successfully',
    data: result,
  });
});

// change password
const changePassword = catchAsync(async (req: Request, res: Response) => {
  console.log("exist change password....");
  const { userId } = (req.user || {}) as any;
  const { newPassword, oldPassword } = req.body;
  console.log({ userId, newPassword, oldPassword });

  const result = await authServices.changePassword({
    userId,
    newPassword,
    oldPassword,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: result,
  });
});

// forgot password
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  // console.log("email");
  // console.log(req?.body?.email);
  const { email } = req.body;

  const result = await authServices.forgotPasswordByEmail(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'An OTP sent to your email!',
    data: result,
  });
});

// forgot password
const forgotPasswordOtpMatch = catchAsync(
  async (req: Request, res: Response) => {
    console.log('hello')
    const token = req?.headers?.token as string;

    const { otp } = req.body;
    console.log({ otp, token },"opt token========");

    const result = await authServices.forgotPasswordOtpMatch({ otp, token });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Otp match successfully',
      data: result,
    });
  },
);


// reset password
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const token = req?.headers?.token as string;

  const { newPassword, confirmPassword } = req.body;



  const result = await authServices.resetPassword({
    token,
    newPassword,
    confirmPassword,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successfully',
    data: result,
  });
});

// refresh token
const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.headers?.refreshToken as string;
  console.log("refresh token ->> ", token);
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Refresh token not found');
  }
  const result = await authServices.refreshToken(token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Access token retrieved successfully',
    data: result,
  });
});
const resendOtpPhone = catchAsync(async (req: Request, res: Response) => {
  const token = req.headers?.token as string;
  console.log({ token });
  const result = await authServices.resendOtpPhone(token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Otp resent successfully',
    data: result,
  });
});

export const authControllers = {
  login,
  googleLogin,
  changePassword,
  forgotPassword,
  forgotPasswordOtpMatch,
  resetPassword,
  refreshToken,
  resendOtpPhone,
};
