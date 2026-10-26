import { Router } from 'express';
import { otpControllers } from './otp.controller'; 
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
import { phoneOtpLimiter } from '../../utils/rateLimiter';
export const otpRoutes = Router();


  otpRoutes.patch('/resend-email-otp', otpControllers.resendOtp);
  otpRoutes.patch('/send-phone-verification-otp', auth(USER_ROLE.USER, USER_ROLE.ADMIN,USER_ROLE.SUPER_ADMIN), phoneOtpLimiter, otpControllers.sendPhoneVerificationOtp);

