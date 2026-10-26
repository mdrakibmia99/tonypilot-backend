import colors from 'colors';
import { createServer, Server as HttpServer } from 'http';
import mongoose from 'mongoose';
import { Server as SocketIoServer } from 'socket.io';
import app from './app';
import config from './app/config';
import createDefaultAdmin from './app/db/createDefaultAdmin';
import { initSocket } from './socket';
import { startScheduler } from './jobs/cornJobSchedule';
import { connectRedis, disconnectRedis } from './app/redis';
import logger from './app/utils/logger';

let apiServer: HttpServer;
let socketServer: HttpServer;
let io: SocketIoServer;

// ================= Main Bootstrap Function =================
async function main() {
  try {
    // 1. Connect MongoDB
    await mongoose.connect(config.database_url as string);
    console.log(colors.green('✅ Database connected successfully').bold);
    mongoose.set('debug', process.env.NODE_ENV === 'development');

    // 2. Connect Redis (Dedicated Cache Client + Pub/Sub Clients for Adapter)
    await connectRedis();

    // 3. Create independent HTTP servers for Express and Socket.IO
    apiServer = createServer(app);
    socketServer = createServer();

    // 4. Attach Socket.IO with Redis Adapter to its dedicated server
    io = initSocket(socketServer);

    // 5. Start both servers
    apiServer.listen(config.port, () => {
      console.log(
        colors.green(`🚀 HTTP API Server running at ${config.ip}:${config.port}`).bold
      );
    });

    socketServer.listen(config.socket_port, () => {
      console.log(
        colors.green(`⚡ Socket.IO Server running at ${config.ip}:${config.socket_port}`).bold
      );
    });

    // 6. Bootstrap default admin and scheduled background tasks
    await createDefaultAdmin();
    startScheduler();
    console.log(colors.green('✅ Server bootstrapped successfully').bold);
  } catch (error: any) {
    logger.error('❌ Server startup error:', error);
    console.error('❌ Server start error:', error);
    process.exit(1);
  }
}

// ================= Graceful Shutdown =================
const gracefulShutdown = async (signal: string) => {
  console.log(colors.yellow(`⚠️ Received ${signal}. Initiating graceful shutdown...`).bold);
  try {
    if (io) {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
    if (apiServer?.listening) {
      await new Promise<void>((resolve, reject) =>
        apiServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
    if (socketServer?.listening) {
      await new Promise<void>((resolve, reject) =>
        socketServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
    await mongoose.disconnect();
    await disconnectRedis();
    console.log(colors.green('👋 Server shutdown completed cleanly.').bold);
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', async (err: any) => {
  console.error('⚠️ Unhandled Rejection:', err);
  await gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', async (err: any) => {
  console.error('⚠️ Uncaught Exception:', err);
  await gracefulShutdown('uncaughtException');
});

main();
