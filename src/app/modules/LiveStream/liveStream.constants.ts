export const LIVE_STREAM_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  TERMINATED_BY_ADMIN: 'terminated_by_admin',
} as const;

export type TLiveStreamStatus =
  (typeof LIVE_STREAM_STATUS)[keyof typeof LIVE_STREAM_STATUS];

export const LIVE_STREAM_STATUS_ENUM = Object.values(LIVE_STREAM_STATUS);

export const LIVE_STREAM_SEARCHABLE_FIELDS = ['channelName', 'roomId'];

export const LIVE_STREAM_REDIS_KEYS = {
  ACTIVE_LIST: 'streams:active',
  ADMIN_ACTIVE_LIST: 'admin:streams:active',
  STREAM_STATE: (streamId: string) => `stream:${streamId}:state`,
  STREAM_VIEWERS: (streamId: string) => `stream:${streamId}:viewers`,
  ACTIVE_LIST_TTL: 30, // 30 seconds cache-aside
  EPHEMERAL_TTL: 86400, // 24 hours
} as const;
