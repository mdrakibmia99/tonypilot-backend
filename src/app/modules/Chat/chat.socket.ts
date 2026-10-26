import { Server as SocketIoServer, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { MessageService } from '../Message/message.service';
import { Chat } from './chat.model';
import { RedisService } from '../../redis';
import logger from '../../utils/logger';

interface ISocketTypingPayload {
  chatId: string;
}

interface ISocketDeleteMessagePayload {
  messageId: string;
}

interface ISocketMarkReadPayload {
  chatId: string;
}

/**
 * Registers real-time Chat and Messaging event listeners for an authenticated socket.
 */
export const registerChatSocketHandlers = (io: SocketIoServer, socket: Socket): void => {
  const userId = socket.user?.userId;
  if (!userId) return;

  const isInChatRoom = (chatId: string): boolean =>
    Types.ObjectId.isValid(chatId) && socket.rooms.has(`chat:${chatId}`);

  // ==========================================
  // 1. Join Chat Room
  // ==========================================
  socket.on('join_chat', async ({ chatId }: { chatId: string }, callback?: (res: { success: boolean; message?: string }) => void) => {
    try {
      if (!Types.ObjectId.isValid(chatId)) {
        if (callback) callback({ success: false, message: 'Invalid Chat ID' });
        return;
      }

      // Verify user is a member of this chat
      const chat = await Chat.findOne({
        _id: new Types.ObjectId(chatId),
        participants: new Types.ObjectId(userId),
      }).select('_id').lean();

      if (!chat) {
        if (callback) callback({ success: false, message: 'You are not a participant in this chat' });
        return;
      }

      await socket.join(`chat:${chatId}`);
      logger.info(`Socket ${socket.id} (User: ${userId}) joined room chat:${chatId}`);

      if (callback) callback({ success: true, message: `Joined chat:${chatId}` });
    } catch (err: any) {
      logger.error('Error in join_chat socket event:', err);
      if (callback) callback({ success: false, message: err?.message || 'Failed to join chat' });
    }
  });

  // ==========================================
  // 2. Leave Chat Room
  // ==========================================
  socket.on('leave_chat', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.leave(`chat:${chatId}`);
      logger.info(`Socket ${socket.id} left room chat:${chatId}`);
    }
  });

  // ==========================================
  // 3. Typing Indicator (Start)
  // ==========================================
  socket.on('typing_start', ({ chatId }: ISocketTypingPayload) => {
    if (isInChatRoom(chatId)) {
      // Broadcast to everyone in the room except the typing sender
      socket.to(`chat:${chatId}`).emit('typing_status', {
        chatId,
        userId,
        isTyping: true,
      });
    }
  });

  // ==========================================
  // 4. Typing Indicator (Stop)
  // ==========================================
  socket.on('typing_stop', ({ chatId }: ISocketTypingPayload) => {
    if (isInChatRoom(chatId)) {
      socket.to(`chat:${chatId}`).emit('typing_status', {
        chatId,
        userId,
        isTyping: false,
      });
    }
  });

  // ==========================================
  // 5. Delete Message for Everyone
  // ==========================================
  socket.on(
    'delete_message_everyone',
    async (
      { messageId }: ISocketDeleteMessagePayload,
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        await MessageService.deleteMessageForEveryone(messageId, userId);
        if (callback) callback({ success: true });
      } catch (err: any) {
        logger.error('Error in delete_message_everyone socket event:', err);
        if (callback) callback({ success: false, error: err?.message || 'Deletion failed' });
      }
    }
  );

  // ==========================================
  // 6. Delete Message for Me
  // ==========================================
  socket.on(
    'delete_message_me',
    async (
      { messageId }: ISocketDeleteMessagePayload,
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        await MessageService.deleteMessageForMe(messageId, userId);
        if (callback) callback({ success: true });
      } catch (err: any) {
        logger.error('Error in delete_message_me socket event:', err);
        if (callback) callback({ success: false, error: err?.message || 'Deletion failed' });
      }
    }
  );

  // ==========================================
  // 7. Mark Chat as Read
  // ==========================================
  socket.on(
    'mark_as_read',
    async (
      { chatId }: ISocketMarkReadPayload,
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        if (!Types.ObjectId.isValid(chatId)) {
          if (callback) callback({ success: false, error: 'Invalid Chat ID' });
          return;
        }

        const result = await Chat.updateOne(
          {
            _id: new Types.ObjectId(chatId),
            participants: new Types.ObjectId(userId),
          },
          { $set: { [`unreadCounts.${userId}`]: 0 } }
        );

        if (result.matchedCount === 0) {
          if (callback) callback({ success: false, error: 'Chat not found or access denied' });
          return;
        }

        await RedisService.del(`chat:list:${userId}`);

        socket.to(`chat:${chatId}`).emit('messages_read', {
          chatId,
          userId,
        });
        if (callback) callback({ success: true });
      } catch (err: any) {
        logger.error('Error in mark_as_read socket event:', err);
        if (callback) callback({ success: false, error: err?.message || 'Failed to mark chat as read' });
      }
    }
  );
};
