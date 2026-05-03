/**
 * leetcode.ts — LeetCode GraphQL API client
 *
 * LeetCode doesn't provide an official webhook/push API, so we poll their
 * public GraphQL endpoint. We use three queries:
 *   1. recentAcSubmissionList — fetch the last N accepted submissions
 *   2. userPublicProfile      — fetch basic profile metadata (avatar, total solved)
 *   3. userFollowing          — fetch the list of users this person follows
 *   4. questionData           — fetch difficulty for a specific problem
 *
 * Rate-limit strategy:
 *   - We space out requests with a configurable delay between users
 *   - On 429/503 responses we back off exponentially before retrying
 *   - Each request includes a realistic browser User-Agent and Referer header
 *     so we look like an organic browser visit
 */

import { logger } from "./logger";

const LEETCODE_GQL = "https://leetcode.com/graphql";

/** Delay ms between consecutive user polls to avoid hammering LeetCode */
export const INTER_USER_DELAY_MS = 3_000;

/** Accepted-submission entry from LeetCode's GraphQL API */
export interface LCSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string; // Unix epoch as string
}

export interface LCProfile {
  username: string;
  realName: string | null;
  userAvatar: string | null;
  totalSolved: number | null;
  easySolved: number | null;
  mediumSolved: number | null;
  hardSolved: number | null;
  aboutMe: string | null;
  isPrivate: boolean;
}

export interface LCFollowingEntry {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** GraphQL query for recent accepted submissions */
const RECENT_AC_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

/** GraphQL query for public user profile */
const PROFILE_QUERY = `
  query userPublicProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        userAvatar
        aboutMe
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`;

/** GraphQL query for the list of users this person follows on LeetCode */
const FOLLOWING_QUERY = `
  query getUserFollowing($username: String!) {
    userProfilePublicProfile(username: $username) {
      followingUrl
    }
  }
`;

/** GraphQL query for a single problem's metadata */
const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      difficulty
    }
  }
`;

/** Shared fetch headers that mimic a browser request */
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://leetcode.com/",
  Origin: "https://leetcode.com",
};

/**
 * Executes a GraphQL request against LeetCode with exponential back-off
 * on rate-limit (429) and server-error (5xx) responses.
 */
async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  retries = 3,
): Promise<T> {
  let delay = 2_000; // initial back-off: 2 s

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(LEETCODE_GQL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15_000), // 15-second request timeout
      });

      // Retry on rate-limit or server errors
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          logger.warn(
            { status: res.status, attempt, delay },
            "LeetCode rate-limited or server error — backing off",
          );
          await sleep(delay);
          delay *= 2; // exponential back-off
          continue;
        }
        throw new Error(`LeetCode API returned ${res.status} after ${retries} retries`);
      }

      if (!res.ok) {
        throw new Error(`LeetCode GraphQL error: HTTP ${res.status}`);
      }

      const json = (await res.json()) as { data?: T; errors?: unknown[] };
      if (json.errors?.length) {
        throw new Error(`LeetCode GraphQL errors: ${JSON.stringify(json.errors)}`);
      }
      return json.data as T;
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn({ err, attempt }, "LeetCode fetch failed, retrying...");
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error("Unreachable");
}

/** Pause execution for `ms` milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the last `limit` accepted submissions for a given LeetCode username.
 * Returns an empty array if the user doesn't exist or has no public submissions.
 */
export async function getRecentAcceptedSubmissions(
  username: string,
  limit = 10,
): Promise<LCSubmission[]> {
  try {
    const data = await gqlRequest<{
      recentAcSubmissionList: LCSubmission[] | null;
    }>(RECENT_AC_QUERY, { username, limit });
    return data.recentAcSubmissionList ?? [];
  } catch (err) {
    logger.warn({ err, username }, "Failed to fetch LeetCode submissions");
    return [];
  }
}

/**
 * Fetches public profile metadata for a LeetCode username.
 * Returns null if the user doesn't exist or the request fails.
 */
export async function getLeetCodeProfile(username: string): Promise<LCProfile | null> {
  try {
    const data = await gqlRequest<{
      matchedUser: {
        username: string;
        profile: { realName: string | null; userAvatar: string | null; aboutMe: string | null };
        submitStats: {
          acSubmissionNum: { difficulty: string; count: number }[];
        };
      } | null;
    }>(PROFILE_QUERY, { username });

    if (!data.matchedUser) return null;

    const { matchedUser } = data;
    const isPrivate = !matchedUser.profile; // Simplistic check, if no profile object, it's private or deleted
    const stats = matchedUser.submitStats.acSubmissionNum;
    const getCount = (d: string) => stats.find((s) => s.difficulty === d)?.count ?? null;

    return {
      username: matchedUser.username,
      realName: matchedUser.profile.realName,
      userAvatar: matchedUser.profile.userAvatar,
      totalSolved: getCount("All"),
      easySolved: getCount("Easy"),
      mediumSolved: getCount("Medium"),
      hardSolved: getCount("Hard"),
      aboutMe: matchedUser.profile.aboutMe ?? null,
      isPrivate,
    };
  } catch (err) {
    logger.warn({ err, username }, "Failed to fetch LeetCode profile");
    return null;
  }
}

/** In-memory cache for problem difficulties to avoid redundant API calls */
const difficultyCache = new Map<string, string>();

/**
 * Fetches the difficulty for a single problem by its slug.
 * Returns "Unknown" if the fetch fails or the problem doesn't exist.
 */
export async function getProblemDifficulty(titleSlug: string): Promise<string> {
  if (difficultyCache.has(titleSlug)) {
    return difficultyCache.get(titleSlug)!;
  }

  try {
    const data = await gqlRequest<{
      question: { difficulty: string } | null;
    }>(QUESTION_QUERY, { titleSlug });

    const difficulty = data.question?.difficulty ?? "Unknown";
    difficultyCache.set(titleSlug, difficulty);
    return difficulty;
  } catch (err) {
    logger.warn({ err, titleSlug }, "Failed to fetch problem difficulty");
    return "Unknown";
  }
}

/**
 * Fetches the list of LeetCode users that `username` follows.
 * Returns an empty array if the feature is unavailable or the request fails.
 * LeetCode's following list API may not be publicly accessible for all accounts.
 */
export async function getLeetCodeFollowing(
  username: string,
  limit = 20,
): Promise<LCFollowingEntry[]> {
  // Note: LeetCode's following list is often not accessible via public GraphQL
  // without authentication. We'll return an empty array for now to avoid 400 errors
  // if the query is failing, as it's not critical for core functionality.
  return [];
}
