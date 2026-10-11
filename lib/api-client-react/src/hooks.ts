import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

import type {
  ActivityFeedItem,
  ActivityStats,
  CreateFollowBody,
  DbProfileSummary,
  DeletePushSubscriptionBody,
  Follow,
  GetDbProfileSummaryParams,
  GetLeaderboardParams,
  GetVapidPublicKey200,
  HealthStatus,
  HeatmapDataPoint,
  LeaderboardEntry,
  LeetcodeProfile,
  ListActivityParams,
  ListNotificationsParams,
  MarkAllNotificationsRead200,
  Notification,
  Preferences,
  PushSubscribeResponse,
  SavePushSubscriptionBody,
  UpdatePreferencesBody,
} from "./types";

import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// ─── Health Check ────────────────────────────────────────────────────────────

export const getHealthCheckUrl = () => `/api/healthz`;

export const healthCheck = async (
  options?: RequestInit,
): Promise<HealthStatus> => {
  return customFetch<HealthStatus>(getHealthCheckUrl(), {
    ...options,
    method: "GET",
  });
};

export const getHealthCheckQueryKey = () => [`/api/healthz`] as const;

export function useHealthCheck(options?: {
  query?: Partial<UseQueryOptions<HealthStatus, ErrorType<void>, HealthStatus>>;
  request?: RequestInit;
}): UseQueryResult<HealthStatus, ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getHealthCheckQueryKey();
  const queryFn = () => healthCheck(options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

// ─── Follows ─────────────────────────────────────────────────────────────────

export const getListFollowsUrl = () => `/api/follows`;

export const listFollows = async (options?: RequestInit): Promise<Follow[]> => {
  return customFetch<Follow[]>(getListFollowsUrl(), {
    ...options,
    method: "GET",
  });
};

export const getListFollowsQueryKey = () => [`/api/follows`] as const;

export function useListFollows(options?: {
  query?: Partial<UseQueryOptions<Follow[], ErrorType<void>, Follow[]>>;
  request?: RequestInit;
}): UseQueryResult<Follow[], ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getListFollowsQueryKey();
  const queryFn = () => listFollows(options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getCreateFollowUrl = () => `/api/follows`;

export const createFollow = async (
  createFollowBody: CreateFollowBody,
  options?: RequestInit,
): Promise<Follow> => {
  return customFetch<Follow>(getCreateFollowUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(createFollowBody),
  });
};

export const useCreateFollow = (options?: {
  mutation?: UseMutationOptions<
    Follow,
    ErrorType<void>,
    { data: CreateFollowBody }
  >;
  request?: RequestInit;
}): UseMutationResult<Follow, ErrorType<void>, { data: CreateFollowBody }> => {
  return useMutation({
    mutationFn: ({ data }) => createFollow(data, options?.request),
    ...options?.mutation,
  });
};

export const getDeleteFollowUrl = (id: number) => `/api/follows/${id}`;

export const deleteFollow = async (
  id: number,
  options?: RequestInit,
): Promise<void> => {
  return customFetch<void>(getDeleteFollowUrl(id), {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteFollow = (options?: {
  mutation?: UseMutationOptions<void, ErrorType<void>, { id: number }>;
  request?: RequestInit;
}): UseMutationResult<void, ErrorType<void>, { id: number }> => {
  return useMutation({
    mutationFn: ({ id }) => deleteFollow(id, options?.request),
    ...options?.mutation,
  });
};

// ─── Notifications ───────────────────────────────────────────────────────────

export const getListNotificationsUrl = (params?: ListNotificationsParams) => {
  const query = new URLSearchParams();
  if (params?.unreadOnly !== undefined) {
    query.append("unreadOnly", String(params.unreadOnly));
  }
  const qs = query.toString();
  return `/api/notifications${qs ? `?${qs}` : ""}`;
};

export const listNotifications = async (
  params?: ListNotificationsParams,
  options?: RequestInit,
): Promise<Notification[]> => {
  return customFetch<Notification[]>(getListNotificationsUrl(params), {
    ...options,
    method: "GET",
  });
};

export const getListNotificationsQueryKey = (
  params?: ListNotificationsParams,
) => [`/api/notifications`, ...(params ? [params] : [])] as const;

export function useListNotifications(
  params?: ListNotificationsParams,
  options?: {
    query?: Partial<
      UseQueryOptions<Notification[], ErrorType<void>, Notification[]>
    >;
    request?: RequestInit;
  },
): UseQueryResult<Notification[], ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getListNotificationsQueryKey(params);
  const queryFn = () => listNotifications(params, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getMarkAllNotificationsReadUrl = () =>
  `/api/notifications/read-all`;

export const markAllNotificationsRead = async (
  options?: RequestInit,
): Promise<MarkAllNotificationsRead200> => {
  return customFetch<MarkAllNotificationsRead200>(
    getMarkAllNotificationsReadUrl(),
    {
      ...options,
      method: "PATCH",
    },
  );
};

export const useMarkAllNotificationsRead = (options?: {
  mutation?: UseMutationOptions<
    MarkAllNotificationsRead200,
    ErrorType<void>,
    void
  >;
  request?: RequestInit;
}): UseMutationResult<MarkAllNotificationsRead200, ErrorType<void>, void> => {
  return useMutation({
    mutationFn: () => markAllNotificationsRead(options?.request),
    ...options?.mutation,
  });
};

export const getMarkNotificationReadUrl = (id: number) =>
  `/api/notifications/${id}/read`;

export const markNotificationRead = async (
  id: number,
  options?: RequestInit,
): Promise<Notification> => {
  return customFetch<Notification>(getMarkNotificationReadUrl(id), {
    ...options,
    method: "PATCH",
  });
};

export const useMarkNotificationRead = (options?: {
  mutation?: UseMutationOptions<Notification, ErrorType<void>, { id: number }>;
  request?: RequestInit;
}): UseMutationResult<Notification, ErrorType<void>, { id: number }> => {
  return useMutation({
    mutationFn: ({ id }) => markNotificationRead(id, options?.request),
    ...options?.mutation,
  });
};

// ─── Activity ────────────────────────────────────────────────────────────────

export const getListActivityUrl = (params?: ListActivityParams) => {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.append("limit", String(params.limit));
  if (params?.myUsername !== undefined)
    query.append("myUsername", params.myUsername);
  const qs = query.toString();
  return `/api/activity${qs ? `?${qs}` : ""}`;
};

export const listActivity = async (
  params?: ListActivityParams,
  options?: RequestInit,
): Promise<ActivityFeedItem[]> => {
  return customFetch<ActivityFeedItem[]>(getListActivityUrl(params), {
    ...options,
    method: "GET",
  });
};

export const getListActivityQueryKey = (params?: ListActivityParams) =>
  [`/api/activity`, ...(params ? [params] : [])] as const;

export function useListActivity(
  params?: ListActivityParams,
  options?: {
    query?: Partial<
      UseQueryOptions<ActivityFeedItem[], ErrorType<void>, ActivityFeedItem[]>
    >;
    request?: RequestInit;
  },
): UseQueryResult<ActivityFeedItem[], ErrorType<void>> & {
  queryKey: QueryKey;
} {
  const queryKey = getListActivityQueryKey(params);
  const queryFn = () => listActivity(params, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getGetActivityStatsUrl = () => `/api/activity/stats`;

export const getActivityStats = async (
  options?: RequestInit,
): Promise<ActivityStats> => {
  return customFetch<ActivityStats>(getGetActivityStatsUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetActivityStatsQueryKey = () =>
  [`/api/activity/stats`] as const;

export function useGetActivityStats(options?: {
  query?: Partial<
    UseQueryOptions<ActivityStats, ErrorType<void>, ActivityStats>
  >;
  request?: RequestInit;
}): UseQueryResult<ActivityStats, ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getGetActivityStatsQueryKey();
  const queryFn = () => getActivityStats(options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getGetLeaderboardUrl = (params?: GetLeaderboardParams) => {
  const query = new URLSearchParams();
  if (params?.scope !== undefined) query.append("scope", params.scope);
  if (params?.period !== undefined) query.append("period", params.period);
  const qs = query.toString();
  return `/api/activity/leaderboard${qs ? `?${qs}` : ""}`;
};

export const getLeaderboard = async (
  params?: GetLeaderboardParams,
  options?: RequestInit,
): Promise<LeaderboardEntry[]> => {
  return customFetch<LeaderboardEntry[]>(getGetLeaderboardUrl(params), {
    ...options,
    method: "GET",
  });
};

export const getGetLeaderboardQueryKey = (params?: GetLeaderboardParams) =>
  [`/api/activity/leaderboard`, ...(params ? [params] : [])] as const;

export const getGetLeaderboardQueryOptions = (
  params?: GetLeaderboardParams,
  options?: { request?: RequestInit },
) => ({
  queryKey: getGetLeaderboardQueryKey(params),
  queryFn: () => getLeaderboard(params, options?.request),
});

export function useGetLeaderboard(
  params?: GetLeaderboardParams,
  options?: {
    query?: Partial<
      UseQueryOptions<LeaderboardEntry[], ErrorType<void>, LeaderboardEntry[]>
    >;
    request?: RequestInit;
  },
): UseQueryResult<LeaderboardEntry[], ErrorType<void>> & {
  queryKey: QueryKey;
} {
  const queryKey = getGetLeaderboardQueryKey(params);
  const queryFn = () => getLeaderboard(params, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export const getGetPreferencesUrl = () => `/api/preferences`;

export const getPreferences = async (
  options?: RequestInit,
): Promise<Preferences> => {
  return customFetch<Preferences>(getGetPreferencesUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetPreferencesQueryKey = () => [`/api/preferences`] as const;

export function useGetPreferences(options?: {
  query?: Partial<UseQueryOptions<Preferences, ErrorType<void>, Preferences>>;
  request?: RequestInit;
}): UseQueryResult<Preferences, ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getGetPreferencesQueryKey();
  const queryFn = () => getPreferences(options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getUpdatePreferencesUrl = () => `/api/preferences`;

export const updatePreferences = async (
  updatePreferencesBody: UpdatePreferencesBody,
  options?: RequestInit,
): Promise<Preferences> => {
  return customFetch<Preferences>(getUpdatePreferencesUrl(), {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(updatePreferencesBody),
  });
};

export const useUpdatePreferences = (options?: {
  mutation?: UseMutationOptions<
    Preferences,
    ErrorType<void>,
    { data: UpdatePreferencesBody }
  >;
  request?: RequestInit;
}): UseMutationResult<
  Preferences,
  ErrorType<void>,
  { data: UpdatePreferencesBody }
> => {
  return useMutation({
    mutationFn: ({ data }) => updatePreferences(data, options?.request),
    ...options?.mutation,
  });
};

export const getVerifyLeetcodeUsernameUrl = () => `/api/preferences/verify`;

export const verifyLeetcodeUsername = async (
  options?: RequestInit,
): Promise<Preferences> => {
  return customFetch<Preferences>(getVerifyLeetcodeUsernameUrl(), {
    ...options,
    method: "POST",
  });
};

export const useVerifyLeetcodeUsername = (options?: {
  mutation?: UseMutationOptions<Preferences, ErrorType<void>, void>;
  request?: RequestInit;
}): UseMutationResult<Preferences, ErrorType<void>, void> => {
  return useMutation({
    mutationFn: () => verifyLeetcodeUsername(options?.request),
    ...options?.mutation,
  });
};

// ─── Push ────────────────────────────────────────────────────────────────────

export const getGetVapidPublicKeyUrl = () => `/api/push/vapid-public-key`;

export const getVapidPublicKey = async (
  options?: RequestInit,
): Promise<GetVapidPublicKey200> => {
  return customFetch<GetVapidPublicKey200>(getGetVapidPublicKeyUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetVapidPublicKeyQueryKey = () =>
  [`/api/push/vapid-public-key`] as const;

export function useGetVapidPublicKey(options?: {
  query?: Partial<
    UseQueryOptions<GetVapidPublicKey200, ErrorType<void>, GetVapidPublicKey200>
  >;
  request?: RequestInit;
}): UseQueryResult<GetVapidPublicKey200, ErrorType<void>> & {
  queryKey: QueryKey;
} {
  const queryKey = getGetVapidPublicKeyQueryKey();
  const queryFn = () => getVapidPublicKey(options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getSavePushSubscriptionUrl = () => `/api/push/subscribe`;

export const savePushSubscription = async (
  savePushSubscriptionBody: SavePushSubscriptionBody,
  options?: RequestInit,
): Promise<PushSubscribeResponse> => {
  return customFetch<PushSubscribeResponse>(getSavePushSubscriptionUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(savePushSubscriptionBody),
  });
};

export const useSavePushSubscription = (options?: {
  mutation?: UseMutationOptions<
    PushSubscribeResponse,
    ErrorType<void>,
    { data: SavePushSubscriptionBody }
  >;
  request?: RequestInit;
}): UseMutationResult<
  PushSubscribeResponse,
  ErrorType<void>,
  { data: SavePushSubscriptionBody }
> => {
  return useMutation({
    mutationFn: ({ data }) => savePushSubscription(data, options?.request),
    ...options?.mutation,
  });
};

export const getDeletePushSubscriptionUrl = () => `/api/push/subscribe`;

export const deletePushSubscription = async (
  deletePushSubscriptionBody: DeletePushSubscriptionBody,
  options?: RequestInit,
): Promise<PushSubscribeResponse> => {
  return customFetch<PushSubscribeResponse>(getDeletePushSubscriptionUrl(), {
    ...options,
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(deletePushSubscriptionBody),
  });
};

export const useDeletePushSubscription = (options?: {
  mutation?: UseMutationOptions<
    PushSubscribeResponse,
    ErrorType<void>,
    { data: DeletePushSubscriptionBody }
  >;
  request?: RequestInit;
}): UseMutationResult<
  PushSubscribeResponse,
  ErrorType<void>,
  { data: DeletePushSubscriptionBody }
> => {
  return useMutation({
    mutationFn: ({ data }) => deletePushSubscription(data, options?.request),
    ...options?.mutation,
  });
};

export const getSendMockNotificationUrl = () => `/api/push/test`;

export const sendMockNotification = async (
  options?: RequestInit,
): Promise<PushSubscribeResponse> => {
  return customFetch<PushSubscribeResponse>(getSendMockNotificationUrl(), {
    ...options,
    method: "POST",
  });
};

export const useSendMockNotification = (options?: {
  mutation?: UseMutationOptions<PushSubscribeResponse, ErrorType<void>, void>;
  request?: RequestInit;
}): UseMutationResult<PushSubscribeResponse, ErrorType<void>, void> => {
  return useMutation({
    mutationFn: () => sendMockNotification(options?.request),
    ...options?.mutation,
  });
};

// ─── Profiles ────────────────────────────────────────────────────────────────

export const getGetLeetcodeProfileUrl = (username: string) =>
  `/api/profiles/${username}`;

export const getLeetcodeProfile = async (
  username: string,
  options?: RequestInit,
): Promise<LeetcodeProfile> => {
  return customFetch<LeetcodeProfile>(getGetLeetcodeProfileUrl(username), {
    ...options,
    method: "GET",
  });
};

export const getGetLeetcodeProfileQueryKey = (username: string) =>
  [`/api/profiles/${username}`] as const;

export function useGetLeetcodeProfile(
  username: string,
  options?: {
    query?: Partial<
      UseQueryOptions<LeetcodeProfile, ErrorType<void>, LeetcodeProfile>
    >;
    request?: RequestInit;
  },
): UseQueryResult<LeetcodeProfile, ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getGetLeetcodeProfileQueryKey(username);
  const queryFn = () => getLeetcodeProfile(username, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getGetDbProfileSummaryUrl = (
  username: string,
  params?: GetDbProfileSummaryParams,
) => {
  const query = new URLSearchParams();
  if (params?.period !== undefined) query.append("period", params.period);
  const qs = query.toString();
  return `/api/profiles/${username}/summary${qs ? `?${qs}` : ""}`;
};

export const getDbProfileSummary = async (
  username: string,
  params?: GetDbProfileSummaryParams,
  options?: RequestInit,
): Promise<DbProfileSummary> => {
  return customFetch<DbProfileSummary>(
    getGetDbProfileSummaryUrl(username, params),
    {
      ...options,
      method: "GET",
    },
  );
};

export const getGetDbProfileSummaryQueryKey = (
  username: string,
  params?: GetDbProfileSummaryParams,
) =>
  [`/api/profiles/${username}/summary`, ...(params ? [params] : [])] as const;

export function useGetDbProfileSummary(
  username: string,
  params?: GetDbProfileSummaryParams,
  options?: {
    query?: Partial<
      UseQueryOptions<DbProfileSummary, ErrorType<void>, DbProfileSummary>
    >;
    request?: RequestInit;
  },
): UseQueryResult<DbProfileSummary, ErrorType<void>> & { queryKey: QueryKey } {
  const queryKey = getGetDbProfileSummaryQueryKey(username, params);
  const queryFn = () => getDbProfileSummary(username, params, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getGetProfileHeatmapUrl = (username: string) =>
  `/api/profiles/${username}/heatmap`;

export const getProfileHeatmap = async (
  username: string,
  options?: RequestInit,
): Promise<HeatmapDataPoint[]> => {
  return customFetch<HeatmapDataPoint[]>(getGetProfileHeatmapUrl(username), {
    ...options,
    method: "GET",
  });
};

export const getGetProfileHeatmapQueryKey = (username: string) =>
  [`/api/profiles/${username}/heatmap`] as const;

export function useGetProfileHeatmap(
  username: string,
  options?: {
    query?: Partial<
      UseQueryOptions<HeatmapDataPoint[], ErrorType<void>, HeatmapDataPoint[]>
    >;
    request?: RequestInit;
  },
): UseQueryResult<HeatmapDataPoint[], ErrorType<void>> & {
  queryKey: QueryKey;
} {
  const queryKey = getGetProfileHeatmapQueryKey(username);
  const queryFn = () => getProfileHeatmap(username, options?.request);
  const query = useQuery({ queryKey, queryFn, ...options?.query });
  return { ...query, queryKey };
}

export const getSaveProfileToDbUrl = (username: string) =>
  `/api/profiles/${username}/save`;

export const saveProfileToDb = async (
  username: string,
  options?: RequestInit,
): Promise<DbProfileSummary> => {
  return customFetch<DbProfileSummary>(getSaveProfileToDbUrl(username), {
    ...options,
    method: "POST",
  });
};

export const useSaveProfileToDb = (options?: {
  mutation?: UseMutationOptions<
    DbProfileSummary,
    ErrorType<void>,
    { username: string }
  >;
  request?: RequestInit;
}): UseMutationResult<
  DbProfileSummary,
  ErrorType<void>,
  { username: string }
> => {
  return useMutation({
    mutationFn: ({ username }) => saveProfileToDb(username, options?.request),
    ...options?.mutation,
  });
};
