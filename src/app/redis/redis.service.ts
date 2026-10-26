import logger from '../utils/logger';
import { redisConfig } from './redis.config';
import { redisClient, isRedisAvailable } from './redis.client';

// In-flight promise map to prevent Cache Stampede (Dog-Piling)
const inFlightPromises = new Map<string, Promise<any>>();

/**
 * Retrieve cached data by key.
 * Safely parses JSON; returns null if key doesn't exist or on any Redis/JSON error.
 */
const get = async <T = any>(key: string): Promise<T | null> => {
  if (!isRedisAvailable() || !redisClient) {
    return null;
  }

  try {
    const data = await redisClient.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      // If data is a plain string that is not JSON
      return data as unknown as T;
    }
  } catch (error: any) {
    logger.warn(`[RedisService.get] Failed for key "${key}": ${error?.message || error}`);
    return null;
  }
};

/**
 * Store data in Redis with an optional TTL (Time-To-Live in seconds).
 * Safely serializes data to JSON.
 */
const set = async (key: string, data: any, ttlInSeconds?: number): Promise<void> => {
  if (!isRedisAvailable() || !redisClient) {
    return;
  }

  try {
    const ttl = ttlInSeconds !== undefined ? ttlInSeconds : redisConfig.defaultTTL;
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);

    if (ttl > 0) {
      await redisClient.set(key, serialized, 'EX', ttl);
    } else {
      await redisClient.set(key, serialized);
    }
  } catch (error: any) {
    logger.warn(`[RedisService.set] Failed for key "${key}": ${error?.message || error}`);
  }
};

/**
 * Delete one or multiple keys from Redis.
 */
const del = async (key: string | string[]): Promise<number> => {
  if (!isRedisAvailable() || !redisClient) {
    return 0;
  }

  try {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return 0;

    // Use UNLINK if available (non-blocking), fallback to DEL
    if (typeof redisClient.unlink === 'function') {
      return await redisClient.unlink(...keys);
    }
    return await redisClient.del(...keys);
  } catch (error: any) {
    logger.warn(`[RedisService.del] Failed for key(s) "${key}": ${error?.message || error}`);
    return 0;
  }
};

/**
 * Non-blocking pattern deletion using cursor-based SCAN.
 * Safely batches keys with COUNT 100 to avoid blocking the single-threaded Redis engine.
 * Example patterns: 'users:*', 'user:123:*', 'products:list:*'
 */
const delByPattern = async (pattern: string): Promise<number> => {
  if (!isRedisAvailable() || !redisClient) {
    return 0;
  }

  try {
    let cursor = '0';
    let totalDeleted = 0;
    const prefix = redisConfig.keyPrefix || '';

    do {
      const [nextCursor, matchingKeys] = await redisClient.scan(
        cursor,
        'MATCH',
        `${prefix}${pattern}`,
        'COUNT',
        100
      );

      cursor = nextCursor;

      if (matchingKeys.length > 0) {
        // Strip prefix because redisClient automatically prepends keyPrefix on write/delete
        const strippedKeys = prefix
          ? matchingKeys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k))
          : matchingKeys;

        const count =
          typeof redisClient.unlink === 'function'
            ? await redisClient.unlink(...strippedKeys)
            : await redisClient.del(...strippedKeys);

        totalDeleted += count;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      logger.info(`[RedisService.delByPattern] Deleted ${totalDeleted} key(s) matching "${pattern}"`);
    }
    return totalDeleted;
  } catch (error: any) {
    logger.warn(`[RedisService.delByPattern] Failed for pattern "${pattern}": ${error?.message || error}`);
    return 0;
  }
};

/**
 * Cache-Aside Pattern with Stampede Protection.
 * Checks cache first; if missing, calls fetchFn, stores in Redis with TTL, and returns.
 */
const getOrSet = async <T = any>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlInSeconds?: number
): Promise<T> => {
  const cached = await get<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Deduplicate in-flight promises to prevent Cache Stampede
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key) as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const freshData = await fetchFn();
      if (freshData !== null && freshData !== undefined) {
        set(key, freshData, ttlInSeconds).catch((err) =>
          logger.warn(`[RedisService.getOrSet] Background cache set failed for "${key}":`, err)
        );
      }
      return freshData;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, fetchPromise);
  return fetchPromise;
};

/**
 * Check if a key exists.
 */
const exists = async (key: string): Promise<boolean> => {
  if (!isRedisAvailable() || !redisClient) return false;
  try {
    const count = await redisClient.exists(key);
    return count > 0;
  } catch {
    return false;
  }
};

/**
 * Get remaining TTL for a key.
 */
const ttl = async (key: string): Promise<number> => {
  if (!isRedisAvailable() || !redisClient) return -2;
  try {
    return await redisClient.ttl(key);
  } catch {
    return -2;
  }
};

/**
 * Set expiration on an existing key.
 */
const expire = async (key: string, ttlInSeconds: number): Promise<boolean> => {
  if (!isRedisAvailable() || !redisClient) return false;
  try {
    const result = await redisClient.expire(key, ttlInSeconds);
    return result === 1;
  } catch {
    return false;
  }
};

// ==========================================
// Redis Sets Operations (For Socket Presence)
// ==========================================

/**
 * Add one or more members to a Redis Set.
 */
const sAdd = async (key: string, ...members: string[]): Promise<number> => {
  if (!isRedisAvailable() || !redisClient || members.length === 0) return 0;
  try {
    return await redisClient.sadd(key, ...members);
  } catch (error: any) {
    logger.warn(`[RedisService.sAdd] Failed for key "${key}": ${error?.message || error}`);
    return 0;
  }
};

/**
 * Remove one or more members from a Redis Set.
 */
const sRem = async (key: string, ...members: string[]): Promise<number> => {
  if (!isRedisAvailable() || !redisClient || members.length === 0) return 0;
  try {
    return await redisClient.srem(key, ...members);
  } catch (error: any) {
    logger.warn(`[RedisService.sRem] Failed for key "${key}": ${error?.message || error}`);
    return 0;
  }
};

/**
 * Get all members of a Redis Set.
 */
const sMembers = async (key: string): Promise<string[]> => {
  if (!isRedisAvailable() || !redisClient) return [];
  try {
    return await redisClient.smembers(key);
  } catch (error: any) {
    logger.warn(`[RedisService.sMembers] Failed for key "${key}": ${error?.message || error}`);
    return [];
  }
};

/**
 * Determine if a given value is a member of a Set.
 */
const sIsMember = async (key: string, member: string): Promise<boolean> => {
  if (!isRedisAvailable() || !redisClient) return false;
  try {
    const isMember = await redisClient.sismember(key, member);
    return isMember === 1;
  } catch {
    return false;
  }
};

/**
 * Get the number of members in a Set (cardinality).
 */
const sCard = async (key: string): Promise<number> => {
  if (!isRedisAvailable() || !redisClient) return 0;
  try {
    return await redisClient.scard(key);
  } catch {
    return 0;
  }
};

export const RedisService = {
  get,
  set,
  del,
  delByPattern,
  getOrSet,
  exists,
  ttl,
  expire,
  sAdd,
  sRem,
  sMembers,
  sIsMember,
  sCard,
};

// Aliases for compatibility
export const cacheService = RedisService;
