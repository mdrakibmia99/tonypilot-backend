import { Server as HttpServer } from 'http';
import { Server as SocketIoServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import colors from 'colors';
import httpStatus from 'http-status';
import {
  pubClient,
  subClient,
  RedisService,
  isRedisAdapterAvailable,
} from './app/redis';
import config from './app/config';
import AppError from './app/error/AppError';
import { verifyToken } from './app/utils/tokenManage';
import { IJwtPayload } from './app/modules/auth/auth.interface';
import { INotification } from './app/modules/notifications/notifications.interface';
import Notification from './app/modules/notifications/notifications.model';
import { User } from './app/modules/user/user.models';
import firebaseAdmin from './app/utils/firebase';
import logger from './app/utils/logger';
import { registerChatSocketHandlers } from './app/modules/Chat/chat.socket';

declare module 'socket.io' {
  interface Socket {
    user: IJwtPayload;
  }
}

// Redis Set keys for distributed user presence
export const REDIS_ONLINE_USERS_KEY = 'online_users';
export const getUserSocketsKey = (userId: string) => `user_sockets:${userId}`;
export const getSocketUserKey = (socketId: string) => `socket_user:${socketId}`;

let io: SocketIoServer | null = null;

/**
 * Returns the active Socket.IO server instance.
 */
export const getIO = (): SocketIoServer => {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet. Ensure initSocket has been invoked.');
  }
  return io;
};

/**
 * Attaches Socket.IO to the HTTP server with Redis Pub/Sub Adapter
 * and real-time distributed user tracking using Redis Sets.
 */
export const initSocket = (httpServer: HttpServer): SocketIoServer => {
  io = new SocketIoServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach Redis Pub/Sub Adapter for multi-instance scaling
  if (isRedisAdapterAvailable()) {
    try {
      io.adapter(createAdapter(pubClient, subClient));
      console.log(colors.green('⚡ Socket.IO Redis Adapter configured successfully.').bold);
    } catch (adapterError) {
      logger.error('Failed to attach Socket.io Redis adapter:', adapterError);
    }
  } else {
    logger.warn('Socket.IO is using the in-memory adapter because Redis is unavailable.');
  }

  // =====================
  // Authentication Middleware
  // =====================
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers?.token as string) ||
        (socket.handshake.headers?.authorization as string);

      if (!token) {
        return next(new AppError(httpStatus.UNAUTHORIZED, 'Socket authentication token missing'));
      }

      // Strip 'Bearer ' if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const payload = verifyToken({
        token: cleanToken,
        access_secret: config.jwt_access_secret as string,
      }) as IJwtPayload;

      if (!payload || !payload.userId) {
        return next(new AppError(httpStatus.UNAUTHORIZED, 'Invalid socket token'));
      }

      socket.user = payload;
      socket.data.userId = payload.userId;
      next();
    } catch (err: any) {
      logger.error(`Socket auth error: ${err?.message || err}`);
      next(new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized socket connection'));
    }
  });

  // =====================
  // Connection Handler
  // =====================
  io.on('connection', async (socket: Socket) => {
    const userId = socket.user?.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const socketId = socket.id;

    // Join user-specific room across Redis nodes
    socket.join(`user:${userId}`);

    // Track user presence in Redis Sets
    try {
      // 1. Add socket.id to user's device sockets set
      await RedisService.sAdd(getUserSocketsKey(userId), socketId);

      // 2. Map socketId -> userId for disconnect cleanup
      await RedisService.set(getSocketUserKey(socketId), userId, 86400);

      // 3. Add user to global online_users set
      const isNewOnline = await RedisService.sAdd(REDIS_ONLINE_USERS_KEY, userId);

      // If user was not previously in the online set, broadcast userOnline
      if (isNewOnline === 1) {
        socket.broadcast.emit('userOnline', { userId });
        logger.info(`User ${userId} came online (socket: ${socketId})`);
      }
    } catch (error) {
      logger.error(`Error registering user presence for ${userId}:`, error);
    }

    // Register Chat & Messaging real-time event handlers
    registerChatSocketHandlers(io!, socket);

    // =====================
    // Disconnect Handler
    // =====================
    socket.on('disconnect', async (reason) => {
      try {
        logger.info(`Socket disconnected: ${socketId}, reason: ${reason}`);

        // 1. Remove socket from user's socket set
        await RedisService.sRem(getUserSocketsKey(userId), socketId);
        await RedisService.del(getSocketUserKey(socketId));

        // 2. Check if user has other active sockets (other tabs or devices)
        const activeSocketsCount = await RedisService.sCard(getUserSocketsKey(userId));

        // 3. If no remaining sockets, remove user from online_users set and broadcast userOffline
        if (activeSocketsCount === 0) {
          await RedisService.sRem(REDIS_ONLINE_USERS_KEY, userId);
          socket.broadcast.emit('userOffline', { userId });
          logger.info(`User ${userId} went offline (all devices disconnected)`);
        }
      } catch (error) {
        logger.error(`Error during socket disconnect cleanup for ${userId}:`, error);
      }
    });
  });

  (globalThis as any).io = io;
  return io;
};

// ===============================================
// Distributed Presence Helpers (Powered by Redis)
// ===============================================

/**
 * Returns a list of all currently online user IDs.
 */
export const getOnlineUsers = async (): Promise<string[]> => {
  return await RedisService.sMembers(REDIS_ONLINE_USERS_KEY);
};

/**
 * Checks if a specific user is currently online using Redis.
 */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  return await RedisService.sIsMember(REDIS_ONLINE_USERS_KEY, userId);
};

/**
 * Emits an event to all connected sockets belonging to a specific user.
 * Automatically broadcasts across all Redis adapter nodes.
 */
export const emitToUser = (userId: string, event: string, data: any): void => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emits an event to all connected clients across the entire cluster.
 */
export const emitToAll = (event: string, data: any): void => {
  if (!io) return;
  io.emit(event, data);
};

/**
 * Emits a real-time notification to a user with automatic FCM push notification fallback.
 */
export const emitNotification = async ({
  senderId,
  receiverId,
  message,
  type,
}: Partial<INotification>) => {
  if (!io) throw new Error('Socket.IO is not initialized');
  if (!receiverId) return null;

  const receiverIdStr = receiverId.toString();

  // 1. Persist notification in MongoDB
  const notificationRecord = await Notification.create({
    senderId,
    receiverId,
    message,
    type,
    isRead: false,
  }).catch((err) => {
    logger.error('Failed to persist notification:', err);
    return null;
  });

  // 2. Check if user is currently online using Redis
  const online = await isUserOnline(receiverIdStr);

  if (online && message) {
    emitToUser(receiverIdStr, 'notification', {
      success: true,
      statusCode: 200,
      data: notificationRecord,
    });
  }

  // 3. Send Push Notification via Firebase (FCM) if user has token
  try {
    const receiver = await User.findById(receiverId).select('fcmToken').lean();
    if (receiver?.fcmToken) {
      await firebaseAdmin.messaging().send({
        token: receiver.fcmToken,
        notification: {
          title: message?.title || 'New Notification',
          body: message?.body || 'You have received a new update.',
        },
        data: {
          userId: senderId ? senderId.toString() : '',
          type: type || 'default',
        },
      });
      logger.info(`📱 FCM Push notification sent to user ${receiverIdStr}`);
    }
  } catch (fcmError: any) {
    logger.error('FCM push notification error:', fcmError?.message || fcmError);
  }

  return notificationRecord;
};

export const deleteMessageConfirmation = async ({
  targetId,
  senderId,
  chatId,
  messageId,
}: any) => {
  if (!io) return;
  const payload = { chatId, messageId };
  emitToUser(targetId, 'deleteMessage', payload);
  emitToUser(senderId, 'deleteMessage', payload);
};

export const emergencyServicerNotification = async (
  nearbyUsers: any[],
  _sosService: any,
  getServiceDetails: any
) => {
  for (const user of nearbyUsers) {
    const userId = user._id.toString();
    const online = await isUserOnline(userId);
    if (!online) continue;

    emitToUser(userId, 'emergencyServiceNotification', {
      message: 'New emergency service nearby!',
      data: getServiceDetails,
    });
  }
};

export const multiBookingNotification = async (
  nearbyUsers: any[],
  serviceDetails: any
) => {
  for (const user of nearbyUsers) {
    const userId = user._id.toString();
    const online = await isUserOnline(userId);

    if (online) {
      emitToUser(userId, 'multiBookingNotification', {
        message: 'New multi guard booking available nearby',
        data: serviceDetails,
      });
    }
  }
};

export const serviceJoinNotification = async ({ clientId, payload }: any) => {
  const userId = clientId.toString();
  const online = await isUserOnline(userId);

  if (online) {
    emitToUser(userId, 'serviceJoinNotification', {
      message: 'Join a new guard',
      data: payload,
    });
  }
};

export default initSocket;
