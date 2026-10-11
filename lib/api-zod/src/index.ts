import * as zod from "zod";

/**
 * Health check
 */
export const HealthCheckResponse = zod.object({
  status: zod.string(),
});

/**
 * Follow schemas
 */
export const ListFollowsResponseItem = zod.object({
  id: zod.number(),
  userId: zod.string(),
  leetcodeUsername: zod.string(),
  displayName: zod.string().nullish(),
  avatarUrl: zod.string().nullish(),
  totalSolved: zod.number().nullish(),
  lastPolledAt: zod.string().nullish(),
  createdAt: zod.string(),
});
export const ListFollowsResponse = zod.array(ListFollowsResponseItem);

export const CreateFollowBody = zod.object({
  leetcodeUsername: zod.string(),
});

export const DeleteFollowParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * Notifications schemas
 */
export const ListNotificationsQueryParams = zod.object({
  unreadOnly: zod.coerce.boolean().optional(),
});

export const ListNotificationsResponseItem = zod.object({
  id: zod.number(),
  userId: zod.string(),
  message: zod.string(),
  type: zod.string(),
  leetcodeUsername: zod.string().nullish(),
  problemTitle: zod.string().nullish(),
  problemSlug: zod.string().nullish(),
  difficulty: zod.string().nullish(),
  submissionId: zod.string().nullish(),
  read: zod.boolean(),
  solvedAt: zod.string().nullish(),
  createdAt: zod.string(),
});
export const ListNotificationsResponse = zod.array(
  ListNotificationsResponseItem,
);

export const MarkAllNotificationsReadResponse = zod.object({
  success: zod.boolean(),
});

export const MarkNotificationReadParams = zod.object({
  id: zod.coerce.number(),
});

export const MarkNotificationReadResponse = zod.object({
  id: zod.number(),
  userId: zod.string(),
  message: zod.string(),
  type: zod.string(),
  leetcodeUsername: zod.string().nullish(),
  problemTitle: zod.string().nullish(),
  problemSlug: zod.string().nullish(),
  difficulty: zod.string().nullish(),
  submissionId: zod.string().nullish(),
  read: zod.boolean(),
  solvedAt: zod.string().nullish(),
  createdAt: zod.string(),
});

/**
 * Activity schemas
 */
export const ListActivityQueryParams = zod.object({
  limit: zod.coerce.number().optional(),
  myUsername: zod.coerce.string().optional(),
});

export const ListActivityResponseItem = zod
  .object({
    id: zod.number(),
    leetcodeUsername: zod.string(),
    problemSlug: zod.string(),
    problemTitle: zod.string(),
    difficulty: zod.string(),
    solvedAt: zod.string(),
    titleSlug: zod.string().nullish(),
    submissionId: zod.string().nullish(),
  })
  .and(
    zod.object({
      avatarUrl: zod.string().nullish(),
      displayName: zod.string().nullish(),
    }),
  );
export const ListActivityResponse = zod.array(ListActivityResponseItem);

export const GetActivityStatsResponse = zod.object({
  solvedToday: zod.number(),
  solvedThisWeek: zod.number(),
  topDifficulty: zod.string(),
  mostActiveUser: zod.string().nullish(),
  mostActiveDisplayName: zod.string().nullish(),
});

export const GetLeaderboardQueryParams = zod.object({
  scope: zod.enum(["following", "global"]).optional(),
  period: zod.coerce.string().optional(),
});

export const GetLeaderboardResponseItem = zod.object({
  leetcodeUsername: zod.string(),
  displayName: zod.string().nullish(),
  avatarUrl: zod.string().nullish(),
  solvedInPeriod: zod.number(),
  totalSolved: zod.number().nullish(),
  lastSolvedAt: zod.coerce
    .date()
    .nullish()
    .describe("ISO timestamp of the user's most recent accepted submission"),
  avgTimeBetweenSolves: zod
    .number()
    .nullish()
    .describe("Average hours between consecutive accepted submissions"),
});
export const GetLeaderboardResponse = zod.array(GetLeaderboardResponseItem);

/**
 * Preferences schemas
 */
export const GetPreferencesResponse = zod.object({
  userId: zod.string(),
  emailEnabled: zod.boolean(),
  digestHour: zod.number(),
  digestMinute: zod.number(),
  lastDigestAt: zod.string().nullish(),
  updatedAt: zod.string(),
  leetcodeUsername: zod.string().nullish(),
  isVerified: zod.boolean().optional(),
  verificationToken: zod.string().nullish(),
  onboardingCompleted: zod.boolean().optional(),
});

export const UpdatePreferencesBody = zod.object({
  emailEnabled: zod.boolean().optional(),
  digestHour: zod.number().optional(),
  digestMinute: zod.number().optional(),
  leetcodeUsername: zod.string().nullish(),
  onboardingCompleted: zod.boolean().optional(),
});

export const UpdatePreferencesResponse = zod.object({
  userId: zod.string(),
  emailEnabled: zod.boolean(),
  digestHour: zod.number(),
  digestMinute: zod.number(),
  lastDigestAt: zod.string().nullish(),
  updatedAt: zod.string(),
  leetcodeUsername: zod.string().nullish(),
  isVerified: zod.boolean().optional(),
  verificationToken: zod.string().nullish(),
  onboardingCompleted: zod.boolean().optional(),
});

export const VerifyLeetcodeUsernameResponse = zod.object({
  userId: zod.string(),
  emailEnabled: zod.boolean(),
  digestHour: zod.number(),
  digestMinute: zod.number(),
  lastDigestAt: zod.string().nullish(),
  updatedAt: zod.string(),
  leetcodeUsername: zod.string().nullish(),
  isVerified: zod.boolean().optional(),
  verificationToken: zod.string().nullish(),
  onboardingCompleted: zod.boolean().optional(),
});

/**
 * Push notification schemas
 */
export const GetVapidPublicKeyResponse = zod.object({
  publicKey: zod.string(),
});

export const SavePushSubscriptionBody = zod.object({
  endpoint: zod.string(),
  p256dh: zod.string(),
  auth: zod.string(),
});

export const SavePushSubscriptionResponse = zod.object({
  success: zod.boolean(),
});

export const DeletePushSubscriptionBody = zod.object({
  endpoint: zod.string(),
});

export const DeletePushSubscriptionResponse = zod.object({
  success: zod.boolean(),
});

/**
 * Profile schemas
 */
export const GetLeetcodeProfileParams = zod.object({
  username: zod.coerce.string(),
});

export const GetLeetcodeProfileResponse = zod.object({
  leetcodeUsername: zod.string(),
  displayName: zod.string().nullish(),
  avatarUrl: zod.string().nullish(),
  totalSolved: zod.number().nullish(),
  easySolved: zod.number().nullish(),
  mediumSolved: zod.number().nullish(),
  hardSolved: zod.number().nullish(),
  recentProblems: zod.array(
    zod.object({
      id: zod.number(),
      leetcodeUsername: zod.string(),
      problemSlug: zod.string(),
      problemTitle: zod.string(),
      difficulty: zod.string(),
      solvedAt: zod.string(),
      titleSlug: zod.string().nullish(),
      submissionId: zod.string().nullish(),
    }),
  ),
  following: zod.array(
    zod.object({
      username: zod.string(),
      displayName: zod.string().nullish(),
      avatarUrl: zod.string().nullish(),
    }),
  ),
});

export const GetDbProfileSummaryParams = zod.object({
  username: zod.coerce.string(),
});

export const GetDbProfileSummaryQueryParams = zod.object({
  period: zod.coerce.string().optional(),
});

export const GetDbProfileSummaryResponse = zod.object({
  leetcodeUsername: zod.string(),
  displayName: zod.string().nullish(),
  avatarUrl: zod.string().nullish(),
  totalSolved: zod.number().nullish(),
  solvedInPeriod: zod.number(),
  inDatabase: zod.boolean(),
  recentSlugs: zod.array(zod.string()).optional(),
});

export const GetProfileHeatmapParams = zod.object({
  username: zod.coerce.string(),
});

export const GetProfileHeatmapResponseItem = zod.object({
  date: zod.string(),
  count: zod.number(),
});
export const GetProfileHeatmapResponse = zod.array(
  GetProfileHeatmapResponseItem,
);

export const SaveProfileToDbParams = zod.object({
  username: zod.coerce.string(),
});

export const SaveProfileToDbResponse = zod.object({
  leetcodeUsername: zod.string(),
  displayName: zod.string().nullish(),
  avatarUrl: zod.string().nullish(),
  totalSolved: zod.number().nullish(),
  solvedInPeriod: zod.number(),
  inDatabase: zod.boolean(),
  recentSlugs: zod.array(zod.string()).optional(),
});
