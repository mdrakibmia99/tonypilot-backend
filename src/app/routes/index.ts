import { Router } from 'express';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';
import { otpRoutes } from '../modules/otp/otp.routes';
import { notificationRoutes } from '../modules/notifications/notifications.route';
import { adminRoutes } from '../modules/Admin/admin.route';
import { chatRoutes } from '../modules/Chat/chat.route';
import { messageRoutes } from '../modules/Message/message.route';

const router = Router();

const moduleRoutes = [
  {
    path: '/users',
    route: userRoutes,
  },
  {
    path: '/admin',
    route: adminRoutes,
  },
  {
    path: '/auth',
    route: authRoutes,
  },
  {
    path: '/otp',
    route: otpRoutes,
  },
  {
    path: '/notifications',
    route: notificationRoutes,
  },
  {
    path: '/chats',
    route: chatRoutes,
  },
  {
    path: '/messages',
    route: messageRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
