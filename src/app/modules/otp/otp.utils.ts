import config from '../../config';
import { generateOtp } from '../../utils/otpGenerator';

const generateOptAndExpireTime = () => {
  const otp = generateOtp();

  const otpExpiryTime = parseInt(config.otp_token_expire_time as string) || 2;

  const expiredAt = new Date(Date.now() + otpExpiryTime * 60 * 1000).toISOString();

  return {
    otp,
    expiredAt,
  };
};

export { generateOptAndExpireTime };
