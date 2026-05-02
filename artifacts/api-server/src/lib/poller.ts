/**
 * poller.ts — Background polling worker for LeetCode submissions
 *
 * This module implements the core polling loop that:
 *   1. Loads all unique LeetCode usernames that at least one user follows
 *   2. For each username, fetches the last N accepted submissions from LeetCode
 *   3. Compares against what we already have in solved_problems
 *   4. Persists any new solved problems to the DB
 *   5. Sends in-app notifications to every follower of that username
 *   6. Upserts cached profile metadata into leetcode_profiles (shared across all followers)
 *
 * The poller runs on an interval set by POLL_INTERVAL_MS (default: 5 minutes).
 * Between each individual user request we insert INTER_USER_DELAY_MS (3 s) of
 * sleep to avoid hammering LeetCode's rate limits.
 *
 * backfillUserProblems() is exported separately so the follow route can seed
 * a newly followed user's historical solved problems at follow time.
 */

import { db, followsTable, solvedProblemsTable, notificationsTable, leetcodeProfilesTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import {
  getRecentAcceptedSubmissions,
  getLeetCodeProfile,
  getLeetCodeFollowing,
  getProblemDifficulty,
  sleep,
  INTER_USER_DELAY_MS,
} from "./leetcode";
import { logger } from "./logger";
import { sendPushNotificationsForUser } from "./pushNotification";

/** How often we run a full poll cycle, in milliseconds */
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1_000);

/** Only notify about problems solved in the last 10 minutes */
const NOTIFICATION_THRESHOLD_MS = 10 * 60 * 1_000;

let pollerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * Runs a single complete poll cycle across all followed LeetCode usernames.
 * Safe to call manually (e.g. from tests or admin endpoints).
 */
export async function runPollCycle(): Promise<void> {
  if (isRunning) {
    logger.warn("Poll cycle already in progress — skipping this tick");
    return;
  }
  isRunning = true;
  logger.info("Starting LeetCode poll cycle");

  try {
    // 1. Gather every unique LeetCode username that anyone is following
    const followRows = await db
      .selectDistinct({ leetcodeUsername: followsTable.leetcodeUsername })
      .from(followsTable);

    const usernames = followRows.map((r) => r.leetcodeUsername);
    logger.info({ count: usernames.length }, "Polling LeetCode usernames");

    for (const username of usernames) {
      try {
        await pollUser(username);
      } catch (err) {
        logger.error({ err, username }, "Unhandled error polling user");
      }
      // Throttle: wait between users to respect LeetCode rate limits
      await sleep(INTER_USER_DELAY_MS);
    }

    logger.info("Poll cycle complete");
  } finally {
    isRunning = false;
  }
}

/**
 * Polls a single LeetCode username:
 *   - Fetches recent accepted submissions
 *   - Stores new ones and fires notifications to all followers
 *   - Upserts shared profile metadata into leetcode_profiles table
 */
async function pollUser(username: string): Promise<void> {
  const [submissions, profile, following] = await Promise.all([
    getRecentAcceptedSubmissions(username, 15),
    getLeetCodeProfile(username),
    getLeetCodeFollowing(username, 30),
  ]);

  // 2. Upsert shared profile cache in leetcode_profiles (one row per username)
  if (profile) {
    await db
      .insert(leetcodeProfilesTable)
      .values({
        username,
        displayName: profile.realName ?? null,
        avatarUrl: profile.userAvatar ?? null,
        totalSolved: profile.totalSolved ?? null,
        easySolved: profile.easySolved ?? null,
        mediumSolved: profile.mediumSolved ?? null,
        hardSolved: profile.hardSolved ?? null,
        followingJson: following.length ? JSON.stringify(following) : null,
        lastPolledAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leetcodeProfilesTable.username,
        set: {
          displayName: profile.realName ?? null,
          avatarUrl: profile.userAvatar ?? null,
          totalSolved: profile.totalSolved ?? null,
          easySolved: profile.easySolved ?? null,
          mediumSolved: profile.mediumSolved ?? null,
          hardSolved: profile.hardSolved ?? null,
          followingJson: following.length ? JSON.stringify(following) : null,
          lastPolledAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  if (!submissions.length) return;

  // 3. Check which slugs we've already stored (to find genuinely new ones)
  const slugs = submissions.map((s) => s.titleSlug);
  const existing = await db
    .select({ problemSlug: solvedProblemsTable.problemSlug })
    .from(solvedProblemsTable)
    .where(
      and(
        eq(solvedProblemsTable.leetcodeUsername, username),
        inArray(solvedProblemsTable.problemSlug, slugs),
      ),
    );

  const existingSlugs = new Set(existing.map((r) => r.problemSlug));
  const newSubmissions = submissions.filter((s) => !existingSlugs.has(s.titleSlug));

  if (!newSubmissions.length) {
    logger.debug({ username }, "No new solved problems detected");
    return;
  }

  logger.info(
    { username, count: newSubmissions.length },
    "New solved problems detected",
  );

  // 4. Persist new solved problems (shared helper used by backfill too)
  const rows = await persistNewSubmissions(username, newSubmissions);

  // 5. Filter for "recent" problems to notify about
  const now = Date.now();
  const recentRows = rows.filter(
    (r) => now - r.solvedAt.getTime() <= NOTIFICATION_THRESHOLD_MS,
  );

  if (!recentRows.length) {
    logger.debug({ username }, "New problems stored but none are recent enough for notifications");
    return;
  }

  // 6. Fetch all Clerk user IDs that follow this username
  const followers = await db
    .select({ userId: followsTable.userId })
    .from(followsTable)
    .where(eq(followsTable.leetcodeUsername, username));

  if (!followers.length) return;

  // 7. Create an in-app notification for each follower × each recent problem
  const notifications = [];
  for (const row of recentRows) {
    for (const follower of followers) {
      notifications.push({
        userId: follower.userId,
        message: `${username} solved "${row.problemTitle}"`,
        type: "solve" as const,
        leetcodeUsername: username,
        problemTitle: row.problemTitle,
        problemSlug: row.problemSlug,
        difficulty: row.difficulty,
        read: false,
        solvedAt: row.solvedAt,
      });
    }
  }

  await db.insert(notificationsTable).values(notifications);

  logger.info(
    { username, followers: followers.length, problems: recentRows.length },
    "Notifications dispatched",
  );

  // 8. Send browser push notifications to opted-in followers
  //    One push per follower, summarising all newly solved problems in a single message.
  //    If a user solved multiple problems we list up to 2 titles, then "and N more".
  const problemTitles = recentRows.map((r) => r.problemTitle);
  const previewTitles =
    problemTitles.length <= 2
      ? problemTitles.join(" & ")
      : `${problemTitles.slice(0, 2).join(", ")} and ${problemTitles.length - 2} more`;

  // Use the first problem's slug for the click-through URL
  const firstSlug = recentRows[0]?.problemSlug ?? "";

  await Promise.all(
    followers.map((follower) =>
      sendPushNotificationsForUser(follower.userId, {
        title: `🔥 ${username} just solved a problem!`,
        body: `"${previewTitles}" — try it yourself!`,
        url: firstSlug
          ? `https://leetcode.com/problems/${firstSlug}/`
          : "https://leetcode.com/",
        icon: "/logo.svg",
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves difficulty for each submission, inserts them into solved_problems,
 * and returns the inserted rows. Skips duplicates via ON CONFLICT DO NOTHING.
 */
async function persistNewSubmissions(
  username: string,
  newSubmissions: { titleSlug: string; title: string; timestamp: string }[],
) {
  const CHUNK_SIZE = 10;
  const rows = [];
  
  for (let i = 0; i < newSubmissions.length; i += CHUNK_SIZE) {
    const chunk = newSubmissions.slice(i, i + CHUNK_SIZE);
    const chunkRows = await Promise.all(
      chunk.map(async (s) => {
        const difficulty = await getProblemDifficulty(s.titleSlug);
        return {
          leetcodeUsername: username,
          problemSlug: s.titleSlug,
          problemTitle: s.title,
          difficulty,
          solvedAt: new Date(Number(s.timestamp) * 1_000),
        };
      })
    );
    rows.push(...chunkRows);
  }

  if (rows.length > 0) {
    await db.insert(solvedProblemsTable).values(rows).onConflictDoNothing();
  }
  return rows;
}

/**
 * Backfills a newly followed user's solved problems into the DB.
 *
 * Strategy:
 *   1. Fetch the user's public profile to get their `totalSolved` count.
 *   2. Request exactly `totalSolved + BUFFER` accepted submissions from LeetCode
 *      so we capture every problem they have ever solved (not just the last 100).
 *   3. Persist only the ones not already in the DB — no notifications, because
 *      these are historical solves the follower already knew about.
 *
 * Called once from the follow route immediately after the follow row is created.
 */
export async function backfillUserProblems(username: string): Promise<void> {
  logger.info({ username }, "Backfilling solved problems for new follow");

  // Step 1 — learn how many problems the user has solved so we request them all
  const profile = await getLeetCodeProfile(username);
  const totalSolved = profile?.totalSolved ?? 0;

  // Add a small buffer in case submissions arrive between profile fetch and AC list fetch
  const limit = Math.max(totalSolved + 10, 20);

  logger.info({ username, totalSolved, limit }, "Fetching full submission history");

  const submissions = await getRecentAcceptedSubmissions(username, limit);
  if (!submissions.length) {
    logger.info({ username }, "No submissions found during backfill");
    return;
  }

  // Step 2 — filter out slugs already stored in the DB
  const slugs = submissions.map((s) => s.titleSlug);
  const existing = await db
    .select({ problemSlug: solvedProblemsTable.problemSlug })
    .from(solvedProblemsTable)
    .where(
      and(
        eq(solvedProblemsTable.leetcodeUsername, username),
        inArray(solvedProblemsTable.problemSlug, slugs),
      ),
    );

  const existingSlugs = new Set(existing.map((r) => r.problemSlug));
  const newSubmissions = submissions.filter((s) => !existingSlugs.has(s.titleSlug));

  if (!newSubmissions.length) {
    logger.info({ username }, "All submissions already stored — backfill skipped");
    return;
  }

  // Step 3 — persist everything that is genuinely new
  const rows = await persistNewSubmissions(username, newSubmissions);
  logger.info({ username, stored: rows.length, total: submissions.length }, "Backfill complete");
}

/**
 * Starts the background polling loop.
 * Call once at server startup; it schedules itself recursively with setTimeout
 * (not setInterval) so a slow poll cycle can't cause overlapping runs.
 */
export function startPoller(): void {
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "LeetCode poller started");

  const tick = async () => {
    await runPollCycle();
    // Schedule the next tick after the cycle completes (not on a fixed clock)
    pollerTimer = setTimeout(tick, POLL_INTERVAL_MS);
  };

  // Kick off after a short delay so the server can finish booting first
  pollerTimer = setTimeout(tick, 10_000);
}

/** Stops the polling loop (for clean shutdown). */
export function stopPoller(): void {
  if (pollerTimer) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
    logger.info("LeetCode poller stopped");
  }
}
