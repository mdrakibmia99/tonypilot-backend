import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { userService } from './user.service';
import httpStatus from 'http-status';
import { storeFile, storeFiles } from '../../utils/fileHelper';
import { User } from './user.models';
import mongoose from 'mongoose';
import AppError from '../../error/AppError';


const createUser = catchAsync(async (req: Request, res: Response) => {
  console.log(req.body);
  const createUserToken = await userService.createUserToken(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Check email for OTP',
    data: createUserToken,
  });
});



const userCreateVerification = catchAsync(async (req, res) => {
  console.log('..........1..........');
  const token = req.headers?.token as string;
  console.log('token', token);
  const { otp } = req.body;
  console.log('otp', otp);
  const newUser = await userService.otpVerifyAndCreateUser({ otp, token });

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User create successfully',
    data: newUser,
  });
});

const createOrLoginUserWithGoogle = catchAsync(async (req: Request, res: Response) => {
  console.log(req.body, "hello google user ");
  const createUserToken = await userService.createOrLoginUserWithGoogle(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'user created or logged in successfully with google',
    data: createUserToken,
  });
});
const createOrLoginUserWithApple = catchAsync(async (req: Request, res: Response) => {

  const createUserToken = await userService.createOrLoginUserWithApple(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'user created or logged in successfully with apple',
    data: createUserToken,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const { userId } = req.user;
  const result = await userService.getAllUserQuery(userId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Users All are requered successful!!',
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getUserById(req?.params?.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  console.log("get my profile ->>> ", req?.user?.userId)
  const { fields } = req.query as { fields?: string };
  const result = await userService.getMyProfile(req?.user?.userId, fields);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile fetched successfully',
    data: result,
  });
});

const getAllUsersOverview = catchAsync(async (req, res) => {
  console.log("get all user overviewo _>>>> ");
  const { userId } = req.user;
  // Default to the current year if the 'year' query parameter is not provided
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

  // Ensure the year is valid
  if (isNaN(year)) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Invalid year parameter.',
      data: null,
    });
  }

  const result = await userService.getUsersOverview(userId, year)
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'get all User overview fetched successfully',
    data: result,
  });
});

const completeMyProfile = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    req.body.profileImage =await storeFile('profile', req?.file);
  } else {
    console.log('complete profile image not found')
    throw new AppError(httpStatus.BAD_REQUEST, 'Profile image is required!');
  }

  const result = await userService.completeMyProfile(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile completed successfully',
    data: result,
  });
});
// const updateMyProfile2 = catchAsync(async (req: Request, res: Response) => {

//     if (req.files && Object.keys(req?.files).length > 0) {
//     try {
//       // Use storeFiles to process all uploaded files
//       console.log('req.files aaaaaaaa->>> ', req.files);
//       const filePaths = await storeFiles(
//         'profile',
//         req.files as { [fieldName: string]: Express.Multer.File[] },
//       );
//       if (filePaths.image && filePaths.image.length > 0) {
//         req.body.profileImage = filePaths.image[0];
//       }

//     } catch (error: any) {
//       console.error('Error processing files:', error.message);
//       return sendResponse(res, {
//         statusCode: httpStatus.BAD_REQUEST,
//         success: false,
//         message: 'Failed to process uploaded files',
//         data: null,
//       });
//     }
//   }

//   const result = await userService.updateMyProfile2(req?.user?.userId, req.body);
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'profile updated successfully',
//     data: result,
//   });
// });
const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  console.log('update my profile');
  if (req?.file) {
    console.log('req.file===', req?.file,  req?.file?.filename);
    req.body.profileImage = await storeFile('profile', req?.file);
  }
  //   if (req.files && Object.keys(req?.files).length > 0) {
  //   try {
  //     // Use storeFiles to process all uploaded files
  //     console.log('req.files aaaaaaaa->>> ', req.files);
  //     const filePaths =await storeFiles(
  //       'profile',
  //       req.files as { [fieldName: string]: Express.Multer.File[] },
  //     );


  //   } catch (error: any) {
  //     console.error('Error processing files:', error.message);
  //     return sendResponse(res, {
  //       statusCode: httpStatus.BAD_REQUEST,
  //       success: false,
  //       message: 'Failed to process uploaded files',
  //       data: null,
  //     });
  //   }
  // }

  const result = await userService.updateMyProfile(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile updated successfully',
    data: result,
  });
});



const deleteMyAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteMyAccount(req.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
});

const completeProfileStatus = catchAsync(async (req: Request, res: Response) => {
  console.log(req.user.userId, "check user id");
  const result = await User.findById(new mongoose.Types.ObjectId(req.user.userId)).select('isProfileComplete');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `profile complete status retrieved successfully`,
    data: result,
  });
});




const getUserProfile = catchAsync(async (req: Request, res: Response) => {

  const result = await userService.getUserProfile(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User profile fetched successfully`,
    data: result,
  });
});


const fcmTokenSetOrRemove = catchAsync(async (req: Request, res: Response) => {
  const { userId } = (req.user || {}) as any;
  const { fcmToken } = req.body // fcm token set or remove
  const status = req.query?.status  // set
  const subscriptionStatus = userService.fcmTokenSetOrRemove(userId, fcmToken, status as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'set or remove fcm token successfully',
    data: subscriptionStatus,
  });
});
export const userController = {
  createUser,
  userCreateVerification,
  getUserById,
  getMyProfile,
  updateMyProfile,
  // updateMyProfile2  ,
  deleteMyAccount,
  getAllUsers,
  getAllUsersOverview,
  completeProfileStatus,
  getUserProfile,
  createOrLoginUserWithGoogle,
  createOrLoginUserWithApple,
  fcmTokenSetOrRemove,
  completeMyProfile



};

export const UserController = userController;
