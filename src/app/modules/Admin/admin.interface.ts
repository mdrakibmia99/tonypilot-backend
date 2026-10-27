export interface ICreateAdmin {
  email: string;
  fullName: string;
}

export type TUserModerationActionType =
  | 'warn'
  | 'suspend'
  | 'ban'
  | 'unban'
  | 'lift_suspension';

export interface IUserModerationActionPayload {
  action: TUserModerationActionType;
  reason: string;
  suspensionDurationDays?: number;
}

export interface IForceTerminateStreamPayload {
  reason: string;
}

export interface IMuteHostPayload {
  reason: string;
}

export type TReviewStoryClaimActionType = 'approve' | 'flag' | 'remove';

export interface IReviewStoryClaimPayload {
  action: TReviewStoryClaimActionType;
  notes?: string;
}

export interface ITelemetryOverview {
  totalUsers: number;
  newUsersToday: number;
  activeLiveStreams: number;
  totalGiftsGiven: number;
  totalClaimsSubmitted: number;
  revenueThisMonthInCents: number;
  openModerationFlags: number;
  recentActivity: Array<{
    action: string;
    performedBy: string;
    timestamp: string;
  }>;
}

export interface IRevenueAnalytics {
  totalRevenueInCents: number;
  recurringMonthlyInCents: number;
  activeSubscribersByTier: {
    free: number;
    premium: number;
    pro: number;
  };
  churnRatePercentage: number;
  timeSeries: Array<{
    date: string;
    amountInCents: number;
    transactionCount: number;
  }>;
}
