import catchAsync from '../../utils/catchAsync';
import { otpServices } from './otp.service';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';

import httpStatus from 'http-status';
import { IJwtPayload } from '../auth/auth.interface';

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const token = req.headers?.token as string;
  const query= req.query;

const result=  await otpServices.resendOtpEmail({ token,query });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP Resent successfully',
    data: result,
  });
});


const sendPhoneVerificationOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await otpServices.sendPhoneVerificationOtp(req.user as IJwtPayload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP send successfully',
    data: result,
  });
});

export const otpControllers = {
  resendOtp,
  sendPhoneVerificationOtp
};
