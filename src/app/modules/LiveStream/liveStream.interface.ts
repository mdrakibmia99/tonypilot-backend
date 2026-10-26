import { Model, Types } from 'mongoose';
import { TLiveStreamStatus } from './liveStream.constants';

export interface TLiveStreamWrapUp {
  airTimeFormatted: string;
  totalLiveClaims: number;
  peakViewerCount: number;
  totalReachCount: number;
  winnerName?: string;
  giftTitle?: string;
}

export interface TLiveStream {
  _id?: Types.ObjectId | string;

  // Room / Channel
  roomId: string;
  channelName: string;

  // Host
  host: Types.ObjectId;

  // Gift Association
  giftItem: Types.ObjectId;

  // Stream State
  status: TLiveStreamStatus;
  scheduledAt?: Date;
  startedAt?: Date | null;
  endedAt?: Date | null;

  // Timer (server-authoritative)
  timerDurationSeconds: number;
  actualDurationSeconds?: number;

  // Viewer Metrics (persisted from Redis on stream end)
  peakViewers: number;
  totalUniqueViewers: number;
  totalReach: number;

  // Winner / Award
  winner?: Types.ObjectId | null;
  winningClaim?: Types.ObjectId | null;
  awardedAt?: Date | null;

  // Pinned State
  pinnedClaim?: Types.ObjectId | null;
  pinnedGiftCard?: boolean;

  // Story Claims Summary
  totalClaimsReceived: number;
  totalClaimsPinned: number;

  // Admin Moderation
  terminatedBy?: Types.ObjectId | null;
  terminationReason?: string;

  // Wrap-Up Summary
  wrapUpSummary?: TLiveStreamWrapUp;

  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveStreamModel extends Model<TLiveStream> {}
