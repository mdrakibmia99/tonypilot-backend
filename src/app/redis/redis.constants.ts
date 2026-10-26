/**
 * Standard Cache TTL (Time-To-Live) constants in seconds.
 * Provides clean readability across controllers and services.
 */
export const CACHE_TTL = {
  ONE_SECOND: 1,
  FIVE_SECONDS: 5,
  TEN_SECONDS: 10,
  THIRTY_SECONDS: 30,
  ONE_MINUTE: 60,
  TWO_MINUTES: 120,
  FIVE_MINUTES: 300,
  TEN_MINUTES: 600,
  FIFTEEN_MINUTES: 900,
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
  TWO_HOURS: 7200,
  SIX_HOURS: 21600,
  TWELVE_HOURS: 43200,
  ONE_DAY: 86400,
  SEVEN_DAYS: 604800,
  THIRTY_DAYS: 2592000,
} as const;

export type CacheTTLValue = (typeof CACHE_TTL)[keyof typeof CACHE_TTL];

/**
 * Standardized key generators to prevent key drift and ensure consistent
 * invalidation patterns across the entire application.
 */
export const cacheKeys = {
  // User domain
  userProfile: (userId: string, fields?: string) =>
    fields ? `user:${userId}:profile:${fields}` : `user:${userId}:profile`,
  userById: (userId: string) => `user:${userId}:detail`,
  userPattern: (userId: string) => `user:${userId}:*`,
  usersList: (queryString: string = '') => `users:list:${queryString || 'all'}`,
  usersOverview: (year: string | number) => `users:overview:${year}`,
  usersAllPattern: () => `users:*`,

  // Dashboard / Admin domain
  adminDashboard: (type: string, param: string = '') => `admin:dashboard:${type}:${param || 'default'}`,
  adminPattern: () => `admin:*`,

  // Generic helper
  custom: (entity: string, identifier: string | number) => `${entity}:${identifier}`,
  customPattern: (entity: string) => `${entity}:*`,
};
