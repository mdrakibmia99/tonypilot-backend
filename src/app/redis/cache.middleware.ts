import { Request, Response, NextFunction } from 'express';
import { RedisService } from './redis.service';
import { CACHE_TTL } from './redis.constants';
import logger from '../utils/logger';

export interface ICacheMiddlewareOptions {
  /**
   * Time-To-Live in seconds for the cached response.
   * Default: 300 seconds (5 minutes).
   */
  ttl?: number;

  /**
   * Optional custom key generator function.
   * Receives the Express Request and returns a string key.
   */
  keyGenerator?: (req: Request) => string;

  /**
   * If true, includes req.user?.userId in the cache key.
   * Default: true if req.user exists, false otherwise.
   */
  userSpecific?: boolean;

  /**
   * Condition function. Return false to bypass caching.
   */
  condition?: (req: Request) => boolean;
}

/**
 * Generates a default cache key based on route, query params, and optional user scope.
 */
export const defaultCacheKeyGenerator = (req: Request, userSpecific?: boolean): string => {
  const urlPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl.split('?')[0];

  // Sort query parameters to ensure deterministic cache keys
  const sortedQueryParams = Object.keys(req.query)
    .sort()
    .map((key) => `${key}=${req.query[key]}`)
    .join('&');

  const queryString = sortedQueryParams ? `?${sortedQueryParams}` : '';

  const userPart =
    (userSpecific ?? Boolean((req as any).user?.userId)) && (req as any).user?.userId
      ? `user:${(req as any).user.userId}:`
      : '';

  return `route:${userPart}${req.method.toLowerCase()}:${urlPath}${queryString}`;
};

/**
 * Declarative Express Route Caching Middleware.
 * Caches standard JSON responses from GET requests in Redis with custom TTL.
 */
export const cacheMiddleware = (options: ICacheMiddlewareOptions = {}) => {
  const ttl = options.ttl ?? CACHE_TTL.FIVE_MINUTES;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Evaluate condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : defaultCacheKeyGenerator(req, options.userSpecific);

    try {
      // 1. Check cache
      const cachedResponse = await RedisService.get<{
        statusCode: number;
        body: any;
      }>(cacheKey);

      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.status(cachedResponse.statusCode || 200).json(cachedResponse.body);
        return;
      }

      // 2. Cache Miss - Set header and hook into response serialization
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      const originalJson = res.json.bind(res);

      res.json = (body: any): Response => {
        // Only cache successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          RedisService
            .set(
              cacheKey,
              {
                statusCode: res.statusCode,
                body,
              },
              ttl
            )
            .catch((err: any) => {
              logger.warn(`Failed to save route cache for key "${cacheKey}":`, err);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.warn(`cacheMiddleware error for key "${cacheKey}":`, error);
      next();
    }
  };
};

export type PatternResolver = string | ((req: Request) => string | string[]);

/**
 * Declarative Invalidation Middleware for Mutation Routes (POST, PUT, PATCH, DELETE).
 * Automatically purges cache keys or patterns upon successful response.
 *
 * Example:
 *   userRoutes.patch(
 *     '/update-my-profile',
 *     auth(),
 *     invalidateCacheMiddleware([
 *       (req) => `user:${req.user?.userId}:*`,
 *       'users:*'
 *     ]),
 *     userController.updateMyProfile
 *   );
 */
export const invalidateCacheMiddleware = (
  patterns: PatternResolver | PatternResolver[]
) => {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];

  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', async () => {
      // Only invalidate when the operation succeeded (2xx or 3xx status)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        try {
          for (const patternResolver of patternList) {
            const resolved =
              typeof patternResolver === 'function'
                ? patternResolver(req)
                : patternResolver;

            const targets = Array.isArray(resolved) ? resolved : [resolved];

            for (const target of targets) {
              if (target.includes('*')) {
                await RedisService.delByPattern(target);
              } else {
                await RedisService.del(target);
              }
            }
          }
        } catch (error) {
          logger.warn('Failed to invalidate cache in middleware:', error);
        }
      }
    });

    next();
  };
};
