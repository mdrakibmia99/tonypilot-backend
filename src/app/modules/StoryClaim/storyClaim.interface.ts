import { Model, Types } from 'mongoose';
import {
  TStoryClaimStatus,
  TAdminReviewStatus,
  TVoteType,
} from './storyClaim.constants';

export interface TStoryClaimVote {
  voter: Types.ObjectId;
  voteType: TVoteType;
}

export interface TLiveStoryClaim {
  _id?: Types.ObjectId | string;

  applicant: Types.ObjectId; // ref -> User (person requesting the gift)
  stream?: Types.ObjectId | null; // ref -> LiveStream, assigned during live preparation
  giftItem: Types.ObjectId; // ref -> GiftItem (primary story association)

  // Story Content
  storyTitle: string;
  storyStatement: string;
  storyMediaUrl?: string;

  // Status
  status: TStoryClaimStatus;

  // Community Voting
  upvotes: number;
  downvotes: number;
  voterIds: Types.ObjectId[];
  votes?: TStoryClaimVote[];

  // Pinning
  isPinned: boolean;
  pinnedAt?: Date | null;
  unpinnedAt?: Date | null;

  // Award
  awardedAt?: Date | null;

  // Admin Review
  adminReviewStatus: TAdminReviewStatus;
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

export type LiveStoryClaimModel = Model<TLiveStoryClaim>;
