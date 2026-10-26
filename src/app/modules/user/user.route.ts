import { Router } from 'express';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { resentOtpValidations } from '../otp/otp.validation';
import { userController } from './user.controller';
import { userValidation } from './user.validation';
import { USER_ROLE } from './user.constants';
import auth from '../../middleware/auth';
const upload = fileUpload('./public/uploads/profile');

export const userRoutes = Router();
// const anyVariableName (like profileUpload ) = fileUpload('./public/uploads/folderName');

userRoutes
  .post(
    '/create',
    validateRequest(userValidation?.userValidationSchema),
    userController.createUser,
  )

  .post(
    '/create-user-verify-otp',
    validateRequest(resentOtpValidations.verifyOtpZodSchema),
    userController.userCreateVerification,
  )


  .get('/get-user-profile', auth(USER_ROLE.USER, USER_ROLE.ADMIN), userController.getUserProfile)
  .delete(
    '/delete-my-account',
    auth(USER_ROLE.USER),
    userController.deleteMyAccount,
  )
userRoutes.get(
  '/my-profile',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  userController.getMyProfile,
);
userRoutes.post(
  '/complete-my-profile',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  upload.single('image'),
  parseData(),
  validateRequest(userValidation.completeProfileSchema),
  userController.completeMyProfile,
)
userRoutes.patch(
  '/update-my-profile',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  upload.single('image'),
  parseData(),
  validateRequest(userValidation.updateProfileSchema),
  userController.updateMyProfile,
)

  .post(
    '/set-or-remove-fcm-token',
    validateRequest(userValidation?.fcmTokenValidationSchema),
    auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    userController.fcmTokenSetOrRemove,
  )



