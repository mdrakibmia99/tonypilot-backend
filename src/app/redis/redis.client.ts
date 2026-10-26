import Redis from 'ioredis';
import colors from 'colors';
import logger from '../utils/logger';
import { getRedisOptions, redisConfig } from './redis.config';
import config from '../config';

class RedisConnectionManager {
  private static instance: RedisConnectionManager;

  // Dedicated clients
  public redisClient: Redis | null = null;
  public pubClient: Redis | null = null;
  public subClient: Redis | null = null;

  private isReady = false;

  private constructor() {
    this.initClients();
  }

  public static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  /**
   * Initializes dedicated primary client and separate Pub/Sub clients for Socket.io adapter.
   */
  private initClients(): void {
    if (!redisConfig.enabled) {
      logger.info('Redis is disabled via configuration.');
      return;
    }

    try {
      // 1. Primary Client (with keyPrefix namespace for caching)
      const primaryOptions = getRedisOptions({ withPrefix: true });
      this.redisClient = redisConfig.url
        ? new Redis(redisConfig.url, primaryOptions)
        : new Redis(primaryOptions);

      // 2. Dedicated Pub Client (without keyPrefix for Socket.io Pub/Sub)
      const pubSubOptions = getRedisOptions({ withPrefix: false });
      this.pubClient = redisConfig.url
        ? new Redis(redisConfig.url, pubSubOptions)
        : new Redis(pubSubOptions);

      // 3. Dedicated Sub Client (without keyPrefix for Socket.io Pub/Sub)
      this.subClient = redisConfig.url
        ? new Redis(redisConfig.url, pubSubOptions)
        : new Redis(pubSubOptions);

      this.registerClientListeners(this.redisClient, 'Primary');
      this.registerClientListeners(this.pubClient, 'Pub');
      this.registerClientListeners(this.subClient, 'Sub');
    } catch (error) {
      logger.error('Failed to initialize Redis clients:', error);
      this.redisClient = null;
      this.pubClient = null;
      this.subClient = null;
    }
  }

  private registerClientListeners(client: Redis | null, name: string): void {
    if (!client) return;

    client.on('connect', () => {
      logger.info(colors.cyan(`🔌 Redis [${name}] socket connecting...`).bold);
    });

    client.on('ready', () => {
      if (name === 'Primary') {
        this.isReady = true;
        console.log(colors.green('🚀 Redis primary client connected & ready').bold);
      }
      logger.info(`Redis [${name}] client ready.`);
    });

    client.on('error', (err: Error) => {
      if (name === 'Primary') this.isReady = false;
      logger.error(`⚠️ Redis [${name}] client error: ${err.message}`);
    });

    client.on('close', () => {
      if (name === 'Primary') this.isReady = false;
      logger.warn(`Redis [${name}] connection closed.`);
    });

    client.on('reconnecting', (time: number) => {
      logger.warn(`Redis [${name}] reconnecting in ${time}ms...`);
    });
  }

  /**
   * Connect all clients concurrently.
   */
  public async connect(): Promise<void> {
    if (!redisConfig.enabled) {
      logger.warn('Redis is disabled in config. Skipping connect.');
      return;
    }

    const connectPromises: Promise<any>[] = [];

    if (this.redisClient && this.redisClient.status !== 'ready' && this.redisClient.status !== 'connecting') {
      connectPromises.push(this.redisClient.connect());
    }
    if (this.pubClient && this.pubClient.status !== 'ready' && this.pubClient.status !== 'connecting') {
      connectPromises.push(this.pubClient.connect());
    }
    if (this.subClient && this.subClient.status !== 'ready' && this.subClient.status !== 'connecting') {
      connectPromises.push(this.subClient.connect());
    }

    try {
      await Promise.all(connectPromises);
      console.log(colors.green(`✅ All Redis clients (Cache, Pub, Sub) connected successfully.Port ${config.redis.port}`).bold);
    } catch (error: any) {
      logger.error(`Failed to connect Redis clients: ${error?.message || error}`);
      this.stopClients();
      console.log(
        colors.yellow(
          '⚠️ Warning: Redis is unreachable. Operating in cache-bypass mode.'
        ).bold
      );
    }
  }

  private stopClients(): void {
    [this.redisClient, this.pubClient, this.subClient].forEach((client) => {
      if (client && client.status !== 'end') {
        client.disconnect(false);
      }
    });
    this.isReady = false;
  }

  /**
   * Gracefully close all Redis connections on shutdown.
   */
  public async disconnect(): Promise<void> {
    const disconnectTasks = [this.redisClient, this.pubClient, this.subClient]
      .filter((c): c is Redis => c !== null)
      .map(async (client) => {
        try {
          if (client.status !== 'end') {
            await client.quit();
          }
        } catch {
          client.disconnect();
        }
      });

    await Promise.allSettled(disconnectTasks);
    this.isReady = false;
    logger.info('All Redis connections gracefully closed.');
  }

  public isAvailable(): boolean {
    return this.isReady && this.redisClient !== null && this.redisClient.status === 'ready';
  }

  public isAdapterAvailable(): boolean {
    return this.pubClient?.status === 'ready' && this.subClient?.status === 'ready';
  }
}

export const redisConnectionManager = RedisConnectionManager.getInstance();

export const redisClient = redisConnectionManager.redisClient!;
export const pubClient = redisConnectionManager.pubClient!;
export const subClient = redisConnectionManager.subClient!;

export const connectRedis = (): Promise<void> => redisConnectionManager.connect();
export const disconnectRedis = (): Promise<void> => redisConnectionManager.disconnect();
export const isRedisAvailable = (): boolean => redisConnectionManager.isAvailable();
export const isRedisAdapterAvailable = (): boolean =>
  redisConnectionManager.isAdapterAvailable();
