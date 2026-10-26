import { Router } from 'express';
import auth from '../../middleware/auth';
import { notificationController } from './notifications.controller';
import { otpControllers } from '../otp/otp.controller';
import { USER_ROLE } from '../user/user.constants';
import { notificationValidation } from './notification.validation';
import validateRequest from '../../middleware/validateRequest';

export const notificationRoutes = Router();



notificationRoutes
  .post(
    "/create",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.USER),
    validateRequest(notificationValidation.notificationSchema),
    notificationController.createNotification
  )
  // .get(
  //   '/all-notifications', 
  //   auth(USER_ROLE.ADMIN,USER_ROLE.DRIVER,USER_ROLE.EMPLOYEE,USER_ROLE.PASSENGER), 
  //   notificationController.getAllNotifications
  // )

  .get(
    '/my-notifications',
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.USER),
    notificationController.getMyNotifications
  )
  .get(
    '/my-unread-notifications',
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.USER),
    notificationController.getMyUnReadNotifications
  )

  .patch(
    '/mark-read/:id',
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    notificationController.markAsRead
  )

  .patch(
    "/read-all",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    notificationController.markAllAsRead
  )


  .delete(
    '/delete/:id',
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.USER),
    notificationController.deleteNotification
  );
