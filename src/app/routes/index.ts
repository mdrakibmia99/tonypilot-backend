import { Router } from 'express';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';
import { otpRoutes } from '../modules/otp/otp.routes';
import { notificationRoutes } from '../modules/notifications/notifications.route';
import { adminRoutes } from '../modules/Admin/admin.route';
import { chatRoutes } from '../modules/Chat/chat.route';
import { messageRoutes } from '../modules/Message/message.route';
import { subscriptionRoutes } from '../modules/Subscription/subscription.route';
import { giftItemRoutes } from '../modules/GiftItem/giftItem.route';
import { saveGiftRoutes } from '../modules/saveGift/saveGift.route';
import { LiveStreamRoutes } from '../modules/LiveStream/liveStream.route';
import { StoryClaimRoutes } from '../modules/StoryClaim/storyClaim.route';
import { LiveCommentRoutes, ModerationRoutes } from '../modules/LiveComment/liveComment.route';

const router = Router();

const moduleRoutes = [
  {
    path: '/live-comments',
    route: LiveCommentRoutes,
  },
  {
    path: '/moderation',
    route: ModerationRoutes,
  },
  {
    path: '/story-claims',
    route: StoryClaimRoutes,
  },
  {
    path: '/live-streams',
    route: LiveStreamRoutes,
  },
  {
    path: '/gift-items',
    route: giftItemRoutes,
  },
  {
    path: '/save-gifts',
    route: saveGiftRoutes,
  },
  {
    path: '/subscriptions',
    route: subscriptionRoutes,
  },
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
