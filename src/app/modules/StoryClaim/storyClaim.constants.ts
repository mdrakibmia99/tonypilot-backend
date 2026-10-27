export const STORY_CLAIM_STATUS = {
  PENDING: 'pending',
  PINNED: 'pinned',
  AWARDED: 'awarded',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;

export type TStoryClaimStatus =
  (typeof STORY_CLAIM_STATUS)[keyof typeof STORY_CLAIM_STATUS];

export const STORY_CLAIM_STATUS_ENUM = Object.values(STORY_CLAIM_STATUS);

export const ADMIN_REVIEW_STATUS = {
  NOT_REVIEWED: 'not_reviewed',
  APPROVED: 'approved',
  FLAGGED: 'flagged',
  REMOVED: 'removed',
} as const;

export type TAdminReviewStatus =
  (typeof ADMIN_REVIEW_STATUS)[keyof typeof ADMIN_REVIEW_STATUS];

export const ADMIN_REVIEW_STATUS_ENUM = Object.values(ADMIN_REVIEW_STATUS);

export const VOTE_TYPE = {
  UPVOTE: 'upvote',
  DOWNVOTE: 'downvote',
} as const;

export type TVoteType = (typeof VOTE_TYPE)[keyof typeof VOTE_TYPE];

export const STORY_CLAIM_SEARCHABLE_FIELDS = ['storyStatement'];

export const STORY_CLAIM_REDIS_KEYS = {
  CLAIMS_STREAM: (streamId: string) => `claims:stream:${streamId}`,
  STREAM_PINNED: (streamId: string) => `stream:${streamId}:pinned_claim`,
  TTL: 15, // 15 seconds
} as const;
