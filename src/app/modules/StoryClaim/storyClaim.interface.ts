import { Model, Types } from 'mongoose';

export type StoryClaimStatus =
  | 'pending'
  | 'pinned'
  | 'awarded'
  | 'rejected'
  | 'withdrawn';

export type AdminReviewStatus =
  | 'not_reviewed'
  | 'approved'
  | 'flagged'
  | 'removed';

export interface TLiveStoryClaim {
  _id?: Types.ObjectId | string;

  applicant: Types.ObjectId; // ref -> User
  stream: Types.ObjectId; // ref -> LiveStream
  giftItem: Types.ObjectId; // ref -> GiftItem

  // Story Content
  storyStatement: string;
  storyMediaUrl?: string;

  // Status
  status: StoryClaimStatus;

  // Community Voting
  upvotes: number;
  downvotes: number;
  voterIds: Types.ObjectId[];

  // Pinning
  isPinned: boolean;
  pinnedAt?: Date | null;
  unpinnedAt?: Date | null;

  // Award
  awardedAt?: Date | null;

  // Admin
  adminReviewStatus: AdminReviewStatus;
  adminReviewedBy?: Types.ObjectId | null;
  adminReviewNotes?: string;
  adminRemovedAt?: Date | null;

  // Pickup (post-award)
  pickupConfirmed: boolean;
  pickupConfirmedAt?: Date | null;
  pickupNotes?: string;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveStoryClaimModel extends Model<TLiveStoryClaim> {}
