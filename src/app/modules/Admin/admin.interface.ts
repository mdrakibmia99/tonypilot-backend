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

export interface ITelemetryKpis {
  neighborGifts: {
    total: number;
    weekGrowth: string;
    availableCount: number;
    claimedCount: number;
    breakdownText: string;
  };
  communityMembers: {
    total: number;
    verifiedPercentage: string;
    activeCount: number;
    footerText: string;
  };
  applicantNeedsVetted: {
    total: number;
    freeRuleRate: string;
    averagePerListing: number;
    footerText: string;
  };
  liveBroadcasts: {
    total: number;
    totalWatching: number;
    watchingText: string;
    footerText: string;
  };
}

export interface ITelemetryActivityStreamItem {
  id: string;
  title: string;
  coverImage: string;
  claimState: string;
  host: {
    id?: string;
    fullName: string;
    email?: string;
    neighborhoodLabel: string;
  };
  donorSubtitle: string;
  storyClaimCount: number;
  storyBadgeText: string;
  pickUpPreference: string;
  timeRemaining: string;
  createdAt: string;
}

export interface ITelemetryTrustSafetyIndex {
  overallScore: string;
  overallPercentage: number;
  freeRuleCompliance: string;
  identityVerifiedDonors: string;
  disputeResolution: string;
  pendingFlagsCount: number;
  pendingFlagsText: string;
  subtitle: string;
}

export interface ITelemetrySidebarBadges {
  userMonitoring: number;
  listingsMonitoring: number;
  storiesClaimsAudit: number;
  liveStreamWatch: number;
  revenue: string;
  subscription: number;
  trustAndSafetyQueue: number;
}

export interface ITelemetryOverview {
  kpis: ITelemetryKpis;
  liveActivityStream: ITelemetryActivityStreamItem[];
  trustSafetyIndex: ITelemetryTrustSafetyIndex;
  sidebarBadges: ITelemetrySidebarBadges;

  // Legacy backwards compatibility fields
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
