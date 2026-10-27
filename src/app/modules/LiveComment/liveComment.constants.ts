export const COMMENT_TYPE = {
  TEXT: 'text',
  EMOJI_REACTION: 'emoji_reaction',
  SYSTEM: 'system',
} as const;

export type TCommentType = (typeof COMMENT_TYPE)[keyof typeof COMMENT_TYPE];
export const COMMENT_TYPE_ENUM = Object.values(COMMENT_TYPE);

export const FLAG_TARGET_TYPE = {
  LIVE_COMMENT: 'live_comment',
  STORY_CLAIM: 'story_claim',
  GIFT_ITEM: 'gift_item',
  USER: 'user',
  LIVE_STREAM: 'live_stream',
} as const;

export type TFlagTargetType =
  (typeof FLAG_TARGET_TYPE)[keyof typeof FLAG_TARGET_TYPE];
export const FLAG_TARGET_TYPE_ENUM = Object.values(FLAG_TARGET_TYPE);

export const TARGET_COLLECTION_MAP: Record<TFlagTargetType, string> = {
  live_comment: 'LiveComment',
  story_claim: 'LiveStoryClaim',
  gift_item: 'GiftItem',
  user: 'User',
  live_stream: 'LiveStream',
};

export const FLAG_REASON_CODE = {
  INAPPROPRIATE_CONTENT: 'inappropriate_content',
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  HATE_SPEECH: 'hate_speech',
  SCAM_FRAUD: 'scam_fraud',
  MISLEADING_INFO: 'misleading_info',
  VIOLENCE: 'violence',
  OTHER: 'other',
} as const;

export type TFlagReasonCode =
  (typeof FLAG_REASON_CODE)[keyof typeof FLAG_REASON_CODE];
export const FLAG_REASON_CODE_ENUM = Object.values(FLAG_REASON_CODE);

export const FLAG_RESOLUTION_STATUS = {
  OPEN: 'open',
  REVIEWED: 'reviewed',
  RESOLVED_NO_ACTION: 'resolved_no_action',
  RESOLVED_ACTION_TAKEN: 'resolved_action_taken',
} as const;

export type TFlagResolutionStatus =
  (typeof FLAG_RESOLUTION_STATUS)[keyof typeof FLAG_RESOLUTION_STATUS];
export const FLAG_RESOLUTION_STATUS_ENUM = Object.values(FLAG_RESOLUTION_STATUS);

export const LIVE_COMMENT_SEARCHABLE_FIELDS = ['message'];

export const LIVE_COMMENT_REDIS_KEYS = {
  RATE_LIMIT: (userId: string) => `ratelimit:comments:${userId}`,
  STREAM_COMMENTS: (streamId: string) => `stream:${streamId}:comments`,
  TTL: 10, // 10 seconds for rate limiting
} as const;
