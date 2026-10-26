import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import { Chat } from '../Chat/chat.model';
import { Message } from './message.model';
import {
  ISendMessagePayload,
  IMessageQueryOptions,
  IPaginatedMessagesResponse,
  ITransformedMessage,
} from './message.interface';
import { RedisService } from '../../redis';
import { emitToUser, getIO, isUserOnline } from '../../../socket';
import { User } from '../user/user.models';
import firebaseAdmin from '../../utils/firebase';
import logger from '../../utils/logger';

const MESSAGES_CACHE_TTL = 120; // 2 minutes for latest page
const getLatestMessagesCacheKey = (chatId: string, userId: string) =>
  `chat:${chatId}:messages:latest:${userId}`;
const getChatListCacheKey = (userId: string) => `chat:list:${userId}`;

/**
 * Sends a message within a chat, updates chat's lastMessage & unreadCounts,
 * invalidates Redis caches, broadcasts via Socket.IO, and sends FCM push to offline users.
 */
const sendMessage = async (senderId: string, payload: ISendMessagePayload) => {
  const { chatId, content, attachments = [] } = payload;

  if (!Types.ObjectId.isValid(chatId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat ID format');
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  const isParticipant = chat.participants.some((p) => p.toString() === senderId);
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to send messages in this chat');
  }

  const senderObjectId = new Types.ObjectId(senderId);
  const chatObjectId = new Types.ObjectId(chatId);

  // 1. Create and persist the new Message
  const newMessage = await Message.create({
    chat: chatObjectId,
    sender: senderObjectId,
    content: content || '',
    attachments,
    isDeletedForEveryone: false,
    deletedByUsers: [],
  });

  // 2. Update Chat: lastMessage, unread counts for other participants, and updatedAt
  chat.lastMessage = newMessage._id;

  if (!chat.unreadCounts) {
    chat.unreadCounts = new Map<string, number>();
  }

  chat.participants.forEach((participantId) => {
    const pStr = participantId.toString();
    if (pStr !== senderId) {
      const currentCount = chat.unreadCounts.get(pStr) || 0;
      chat.unreadCounts.set(pStr, currentCount + 1);
    }
  });

  await chat.save();

  // 3. Populate sender details for client delivery
  const populatedMessage = await Message.findById(newMessage._id)
    .populate('sender', 'fullName profileImage email')
    .lean();

  if (!populatedMessage) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve created message');
  }

  const senderInfo = populatedMessage.sender as any;
  const transformedMessage: ITransformedMessage = {
    _id: populatedMessage._id.toString(),
    chat: populatedMessage.chat.toString(),
    sender: {
      _id: senderInfo._id.toString(),
      fullName: senderInfo.fullName || 'User',
      profileImage: senderInfo.profileImage,
      email: senderInfo.email || '',
    },
    content: populatedMessage.content,
    attachments: populatedMessage.attachments,
    isDeletedForEveryone: false,
    isMyMessage: true,
    createdAt: populatedMessage.createdAt,
    updatedAt: populatedMessage.updatedAt,
  };

  // 4. Invalidate Redis Caches
  await Promise.all([
    RedisService.delByPattern(`chat:${chatId}:messages:*`),
    ...chat.participants.map((p) => RedisService.del(getChatListCacheKey(p.toString()))),
  ]);

  // 5. Real-Time Socket.IO Broadcasts
  try {
    // (A) Deliver only to current participants who opened and joined this chat
    const participantIds = new Set(chat.participants.map((participantId) => participantId.toString()));
    const roomSockets = await getIO().in(`chat:${chatId}`).fetchSockets();

    roomSockets.forEach((roomSocket) => {
      const roomUserId = roomSocket.data.userId as string | undefined;
      if (!roomUserId || !participantIds.has(roomUserId)) return;

      roomSocket.emit('new_message', {
        chatId,
        message: {
          ...transformedMessage,
          isMyMessage: roomUserId === senderId,
        },
      });
    });

    // (B) Broadcast to EVERY participant's personal room (room: user:userId)
    // This allows the Messenger-style Chat List / Inbox to automatically move this chat to the TOP!
    chat.participants.forEach((participantId) => {
      const pStr = participantId.toString();
      const userUnread =
        typeof chat.unreadCounts?.get === 'function'
          ? chat.unreadCounts.get(pStr) || 0
          : (chat.unreadCounts as any)?.[pStr] || 0;

      emitToUser(pStr, 'update_chat_list', {
        chatId,
        lastMessage: {
          _id: transformedMessage._id,
          content: transformedMessage.content,
          sender: transformedMessage.sender,
          isDeletedForEveryone: false,
          createdAt: transformedMessage.createdAt,
        },
        unreadCount: userUnread,
        updatedAt: chat.updatedAt || new Date(),
      });
    });
  } catch (socketError) {
    logger.warn('Socket broadcast failed for new_message:', socketError);
  }

  // 6. Push notification (FCM) to offline participants
  for (const participantId of chat.participants) {
    const pStr = participantId.toString();
    if (pStr !== senderId) {
      const online = await isUserOnline(pStr);
      if (!online) {
        try {
          const recipientUser = await User.findById(pStr).select('fcmToken').lean();
          if (recipientUser?.fcmToken) {
            await firebaseAdmin.messaging().send({
              token: recipientUser.fcmToken,
              notification: {
                title: chat.isGroupChat ? (chat.name || 'Group Chat') : (senderInfo.fullName || 'New Message'),
                body: content || (attachments.length ? 'Sent an attachment' : 'New message'),
              },
              data: {
                type: 'chat_message',
                chatId,
                senderId,
              },
            });
          }
        } catch (fcmError) {
          logger.warn(`Failed to dispatch FCM to user ${pStr}:`, fcmError);
        }
      }
    }
  }

  return transformedMessage;
};

/**
 * Cursor-based Paginated Message Retrieval:
 * - O(1) indexed performance on { chat: 1, _id: -1 }
 * - Never suffers from pagination drift/duplicates caused by incoming messages
 * - Excludes messages cleared by user (`createdAt <= clearedAt`)
 * - Excludes messages where current user is in `deletedByUsers`
 * - Masks content if `isDeletedForEveryone: true`
 */
const getMessagesByChatId = async (
  chatId: string,
  userId: string,
  options: IMessageQueryOptions
): Promise<IPaginatedMessagesResponse> => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat ID');
  }

  const userObjectId = new Types.ObjectId(userId);
  const chatObjectId = new Types.ObjectId(chatId);

  // 1. Verify user membership and check chat clear/visibility boundary
  const chat = await Chat.findById(chatId).lean();
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  const isParticipant = chat.participants.some((p) => p.toString() === userId);
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this conversation');
  }

  // Determine user's clear timestamp
  const visibilityEntry = chat.userChatVisibility?.find(
    (v) => v.user.toString() === userId
  );
  const clearedAt = visibilityEntry ? new Date(visibilityEntry.clearedAt) : null;
console.log('limit=========', options.limit);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const isFirstPage = !options.cursor;

  // 2. Check Redis cache for initial page
  if (isFirstPage) {
    const cacheKey = getLatestMessagesCacheKey(chatId, userId);
    const cachedResponse = await RedisService.get<IPaginatedMessagesResponse>(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  // 3. Build indexed cursor query
  const query: any = {
    chat: chatObjectId,
    deletedByUsers: { $ne: userObjectId },
  };

  // Exclude messages before the user's clear boundary
  if (clearedAt) {
    query.createdAt = { $gt: clearedAt };
  }

  // Cursor condition (older than cursor)
  if (options.cursor) {
    if (!Types.ObjectId.isValid(options.cursor)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid cursor ObjectId format');
    }
    query._id = { $lt: new Types.ObjectId(options.cursor) };
  }

  // 4. Fetch limit + 1 items to efficiently know if more pages exist without a count query
  const messages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('sender', 'fullName profileImage email')
    .lean();

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  const nextCursor =
    hasMore && resultMessages.length > 0
      ? resultMessages[resultMessages.length - 1]._id.toString()
      : null;

  // 5. Transform messages for response and mask deleted content
  const transformedMessages: ITransformedMessage[] = resultMessages.map((m: any) => {
    const isDeletedEveryone = Boolean(m.isDeletedForEveryone);
    return {
      _id: m._id.toString(),
      chat: m.chat.toString(),
      sender: {
        _id: m.sender?._id?.toString() || '',
        fullName: m.sender?.fullName || 'User',
        profileImage: m.sender?.profileImage,
        email: m.sender?.email || '',
      },
      content: isDeletedEveryone ? 'This message was deleted' : m.content || '',
      attachments: isDeletedEveryone ? [] : m.attachments || [],
      isDeletedForEveryone: isDeletedEveryone,
      isMyMessage: m.sender?._id?.toString() === userId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });

  // Reverse to chronological order (oldest to newest) for front-end chat views
  const chronologicalMessages = transformedMessages.reverse();

  // 6. Reset unread counter for current user asynchronously
  Chat.updateOne(
    { _id: chatObjectId },
    { $set: { [`unreadCounts.${userId}`]: 0 } }
  ).catch((err) => logger.warn('Failed to reset unread count in background:', err));

  const response: IPaginatedMessagesResponse = {
    messages: chronologicalMessages,
    nextCursor,
    hasMore,
  };

  // Cache initial page in Redis
  if (isFirstPage) {
    RedisService.set(
      getLatestMessagesCacheKey(chatId, userId),
      response,
      MESSAGES_CACHE_TTL
    ).catch((err) => logger.warn('Cache set failed for latest messages:', err));
  }

  return response;
};

/**
 * Delete for Everyone:
 * Only sender or group admin can perform this.
 * Marks `isDeletedForEveryone: true`, clears original content, and emits real-time event.
 */
const deleteMessageForEveryone = async (messageId: string, userId: string) => {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Message ID');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, 'Message not found');
  }

  if (message.isDeletedForEveryone) {
    return { message: 'Message is already deleted for everyone', messageId };
  }

  const chat = await Chat.findById(message.chat);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Associated chat not found');
  }

  const isSender = message.sender.toString() === userId;
  const isGroupAdmin = chat.isGroupChat && chat.groupAdmin?.toString() === userId;

  if (!isSender && !isGroupAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the sender or group admin has permission to delete this message for everyone'
    );
  }

  message.isDeletedForEveryone = true;
  message.content = '';
  message.attachments = [];
  await message.save();

  const chatIdStr = message.chat.toString();

  // Invalidate Redis caches
  await Promise.all([
    RedisService.delByPattern(`chat:${chatIdStr}:messages:*`),
    ...chat.participants.map((p) => RedisService.del(getChatListCacheKey(p.toString()))),
  ]);

  // Notify every current participant across their active devices
  try {
    chat.participants.forEach((participantId) => {
      emitToUser(participantId.toString(), 'message_deleted_everyone', {
        chatId: chatIdStr,
        messageId,
        deletedBy: userId,
      });
    });
  } catch (socketError) {
    logger.warn('Socket broadcast failed for message_deleted_everyone:', socketError);
  }

  return { success: true, messageId, isDeletedForEveryone: true };
};

/**
 * Delete for Me:
 * Adds current user's ID to `deletedByUsers`.
 * Subsequent queries for this user filter out the message. Other users retain full visibility.
 */
const deleteMessageForMe = async (messageId: string, userId: string) => {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Message ID');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, 'Message not found');
  }

  const userObjectId = new Types.ObjectId(userId);

  const isParticipant = await Chat.exists({
    _id: message.chat,
    participants: userObjectId,
  });
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this chat');
  }

  await Message.findByIdAndUpdate(messageId, {
    $addToSet: { deletedByUsers: userObjectId },
  });

  const chatIdStr = message.chat.toString();

  // Invalidate this user's message cache for this chat
  await RedisService.del(getLatestMessagesCacheKey(chatIdStr, userId));

  // Notify user's other active devices
  emitToUser(userId, 'message_deleted_me', {
    chatId: chatIdStr,
    messageId,
  });

  return { success: true, messageId };
};

export const MessageService = {
  sendMessage,
  getMessagesByChatId,
  deleteMessageForEveryone,
  deleteMessageForMe,
};
