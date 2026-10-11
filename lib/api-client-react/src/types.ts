export interface HealthStatus {
  status: string;
}

export interface Follow {
  id: number;
  userId: string;
  leetcodeUsername: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalSolved?: number | null;
  lastPolledAt?: string | null;
  createdAt: string;
}

export interface CreateFollowBody {
  leetcodeUsername: string;
}

export interface Notification {
  id: number;
  userId: string;
  message: string;
  type: string;
  leetcodeUsername?: string | null;
  problemTitle?: string | null;
  problemSlug?: string | null;
  difficulty?: string | null;
  submissionId?: string | null;
  read: boolean;
  solvedAt?: string | null;
  createdAt: string;
}

export interface SolvedProblem {
  id: number;
  leetcodeUsername: string;
  problemSlug: string;
  problemTitle: string;
  difficulty: string;
  solvedAt: string;
  titleSlug?: string | null;
  submissionId?: string | null;
}

export type ActivityFeedItem = SolvedProblem & {
  avatarUrl?: string | null;
  displayName?: string | null;
};

export interface ActivityStats {
  solvedToday: number;
  solvedThisWeek: number;
  topDifficulty: string;
  mostActiveUser?: string | null;
  mostActiveDisplayName?: string | null;
}

export interface LeaderboardEntry {
  leetcodeUsername: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  solvedInPeriod: number;
  totalSolved?: number | null;
  lastSolvedAt?: string | null;
  avgTimeBetweenSolves?: number | null;
}

export interface LeetcodeFollowingEntry {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface LeetcodeProfile {
  leetcodeUsername: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalSolved?: number | null;
  easySolved?: number | null;
  mediumSolved?: number | null;
  hardSolved?: number | null;
  recentProblems: SolvedProblem[];
  following: LeetcodeFollowingEntry[];
}

export interface DbProfileSummary {
  leetcodeUsername: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalSolved?: number | null;
  solvedInPeriod: number;
  inDatabase: boolean;
  recentSlugs?: string[];
}

export interface Preferences {
  userId: string;
  emailEnabled: boolean;
  digestHour: number;
  digestMinute: number;
  lastDigestAt?: string | null;
  updatedAt: string;
  leetcodeUsername?: string | null;
  isVerified?: boolean;
  verificationToken?: string | null;
  onboardingCompleted?: boolean;
}

export interface UpdatePreferencesBody {
  emailEnabled?: boolean;
  digestHour?: number;
  digestMinute?: number;
  leetcodeUsername?: string | null;
  onboardingCompleted?: boolean;
}

export interface SavePushSubscriptionBody {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DeletePushSubscriptionBody {
  endpoint: string;
}

export interface HeatmapDataPoint {
  date: string;
  count: number;
}

export interface PushSubscribeResponse {
  success: boolean;
}

export type ListNotificationsParams = {
  unreadOnly?: boolean;
};

export type MarkAllNotificationsRead200 = {
  success: boolean;
};

export type ListActivityParams = {
  limit?: number;
  myUsername?: string;
};

export type GetLeaderboardParams = {
  scope?: GetLeaderboardScope;
  period?: string;
};

export type GetLeaderboardScope =
  (typeof GetLeaderboardScope)[keyof typeof GetLeaderboardScope];

export const GetLeaderboardScope = {
  following: "following",
  global: "global",
} as const;

export type GetVapidPublicKey200 = {
  publicKey: string;
};

export type GetDbProfileSummaryParams = {
  period?: string;
};
