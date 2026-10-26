import httpStatus from 'http-status';
import AppError from '../error/AppError';
import catchAsync from '../utils/catchAsync';



const userVerifiedByAdmin = () => {
  return catchAsync(async (req, res, next) => {
    if (!req.user.isVerifiedByAdmin) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Your account is not verified by admin');
    }

    next();
  });
};

export default userVerifiedByAdmin;
