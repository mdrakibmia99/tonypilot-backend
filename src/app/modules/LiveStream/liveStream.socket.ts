import { Server as SocketIoServer, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { RedisService } from '../../redis';
import { LIVE_STREAM_REDIS_KEYS } from './liveStream.constants';
import logger from '../../utils/logger';

// Active timer intervals indexed by streamId
const activeStreamTimers = new Map<string, NodeJS.Timeout>();

/**
 * Starts a 1-second server-authoritative timer for a live stream broadcast.
 * Broadcasts 'timer_tick' to 'stream:{streamId}' every second.
 */
export const startStreamTimer = (
  io: SocketIoServer,
  streamId: string,
  totalDurationSeconds: number,
  startedAtTimestamp?: number,
): void => {
  stopStreamTimer(streamId);

  const startTime = startedAtTimestamp || Date.now();

  const timer = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);

    io.to(`stream:${streamId}`).emit('timer_tick', {
      streamId,
      remainingSeconds,
      elapsedSeconds,
      totalDurationSeconds,
    });

    if (remainingSeconds <= 0) {
      stopStreamTimer(streamId);
      io.to(`stream:${streamId}`).emit('timer_expired', {
        streamId,
        message: 'Live stream broadcast timer has reached 0',
      });
    }
  }, 1000);

  activeStreamTimers.set(streamId, timer);
};

/**
 * Stops an active stream timer.
 */
export const stopStreamTimer = (streamId: string): void => {
  const existingTimer = activeStreamTimers.get(streamId);
  if (existingTimer) {
    clearInterval(existingTimer);
    activeStreamTimers.delete(streamId);
  }
};

/**
 * Registers real-time Live Streaming event handlers for an authenticated socket.
 */
export const registerLiveStreamSocketHandlers = (
  io: SocketIoServer,
  socket: Socket,
): void => {
  const userId = socket.user?.userId;
  if (!userId) return;

  // Track rooms joined by this socket for disconnect cleanup
  const joinedStreams = new Set<string>();

  // ==========================================
  // 1. Join Live Stream Room
  // ==========================================
  socket.on(
    'join_stream',
    async (
      payload: { streamId: string },
      callback?: (res: { success: boolean; viewerCount?: number; message?: string }) => void,
    ) => {
      try {
        const { streamId } = payload;
        if (!streamId || !Types.ObjectId.isValid(streamId)) {
          if (callback) callback({ success: false, message: 'Invalid stream ID' });
          return;
        }

        const roomName = `stream:${streamId}`;
        await socket.join(roomName);
        joinedStreams.add(streamId);

        // Add user to Redis viewer set
        const viewersKey = LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId);
        await RedisService.sAdd(viewersKey, userId);

        const currentViewerCount = await RedisService.sCard(viewersKey);

        // Broadcast updated viewer count to all room participants
        io.to(roomName).emit('viewer_count_update', {
          streamId,
          viewerCount: currentViewerCount,
        });

        logger.info(`User ${userId} joined live stream room: ${roomName} (Count: ${currentViewerCount})`);

        if (callback) {
          callback({
            success: true,
            viewerCount: currentViewerCount,
          });
        }
      } catch (err: any) {
        logger.error(`Error in join_stream handler:`, err);
        if (callback) {
          callback({ success: false, message: err?.message || 'Failed to join stream' });
        }
      }
    },
  );

  // ==========================================
  // 2. Leave Live Stream Room
  // ==========================================
  socket.on(
    'leave_stream',
    async (
      payload: { streamId: string },
      callback?: (res: { success: boolean; message?: string }) => void,
    ) => {
      try {
        const { streamId } = payload;
        if (!streamId) return;

        const roomName = `stream:${streamId}`;
        socket.leave(roomName);
        joinedStreams.delete(streamId);

        // Remove user from Redis viewer set
        const viewersKey = LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId);
        await RedisService.sRem(viewersKey, userId);

        const currentViewerCount = await RedisService.sCard(viewersKey);

        io.to(roomName).emit('viewer_count_update', {
          streamId,
          viewerCount: currentViewerCount,
        });

        logger.info(`User ${userId} left live stream room: ${roomName} (Remaining: ${currentViewerCount})`);

        if (callback) callback({ success: true });
      } catch (err: any) {
        logger.error('Error in leave_stream handler:', err);
      }
    },
  );

  // ==========================================
  // 3. Socket Disconnect Cleanup
  // ==========================================
  socket.on('disconnect', async () => {
    try {
      for (const streamId of joinedStreams) {
        const viewersKey = LIVE_STREAM_REDIS_KEYS.STREAM_VIEWERS(streamId);
        await RedisService.sRem(viewersKey, userId);

        const remainingViewers = await RedisService.sCard(viewersKey);
        io.to(`stream:${streamId}`).emit('viewer_count_update', {
          streamId,
          viewerCount: remainingViewers,
        });
      }
      joinedStreams.clear();
    } catch (err: any) {
      logger.error(`Error cleaning up live stream viewers on disconnect:`, err);
    }
  });
};
