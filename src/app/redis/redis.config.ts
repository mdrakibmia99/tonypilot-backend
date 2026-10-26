import { RedisOptions } from 'ioredis';
import config from '../config';

export interface IRedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  defaultTTL: number;
  enabled: boolean;
  keyPrefix: string;
  maxRetries: number;
  connectTimeout: number;
}

export const redisConfig: IRedisConfig = {
  url: config.redis?.url,
  host: config.redis?.host || '127.0.0.1',
  port: config.redis?.port || 6379,
  password: config.redis?.password || undefined,
  db: config.redis?.db || 0,
  defaultTTL: config.redis?.default_ttl || 300, // 5 minutes default
  enabled: config.redis?.enabled ?? true,
  keyPrefix: config.redis?.key_prefix || 'tonypilot:',
  maxRetries: 5,
  connectTimeout: 10000,
};

/**
 * Builds senior-grade ioredis options with exponential backoff retry logic,
 * reconnection limits, keepAlive, and fail-safe settings.
 *
 * @param options.withPrefix - Whether to include keyPrefix (default: true). Set to false for Pub/Sub.
 */
export const getRedisOptions = (options: { withPrefix?: boolean } = {}): RedisOptions => {
  const { withPrefix = true } = options;

  const baseOptions: RedisOptions = {
    ...(withPrefix && redisConfig.keyPrefix ? { keyPrefix: redisConfig.keyPrefix } : {}),
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    connectTimeout: redisConfig.connectTimeout,
    keepAlive: 10000,
    showFriendlyErrorStack: config.NODE_ENV !== 'production',
    retryStrategy(times: number) {
      if (times > redisConfig.maxRetries) {
        return null;
      }
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(times * 200, 3000) + jitter;
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some((target) => err.message.includes(target));
    },
  };

  if (redisConfig.url) {
    return {
      ...baseOptions,
    };
  }

  return {
    ...baseOptions,
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
  };
};
