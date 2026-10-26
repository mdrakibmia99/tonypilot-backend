export const GIFT_CONDITION = {
  NEW: 'new',
  LIKE_NEW: 'like_new',
  GOOD: 'good',
  FAIR: 'fair',
  WORN: 'worn',
} as const;

export const GIFT_CATEGORY = {
  ELECTRONICS: 'electronics',
  FURNITURE: 'furniture',
  CLOTHING: 'clothing',
  TOYS: 'toys',
  BOOKS: 'books',
  KITCHEN: 'kitchen',
  SPORTS: 'sports',
  HOME_DECOR: 'home_decor',
  TOOLS: 'tools',
  OTHER: 'other',
} as const;

export const GIFT_CLAIM_STATE = {
  AVAILABLE: 'available',
  CLAIMED: 'claimed',
  PICKUP_ARRANGED: 'pickup_arranged',
  DELIVERED: 'delivered',
  EXPIRED: 'expired',
} as const;

export const GIFT_VERIFICATION_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
} as const;

export const GIFT_SEARCHABLE_FIELDS = ['title', 'description', 'tags', 'category'];
