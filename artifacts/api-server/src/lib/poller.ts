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
 */

import { db, followsTable, solvedProblemsTable, notificationsTable, leetcodeProfilesTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import {
  getRecentAcceptedSubmissions,
  getLeetCodeProfile,
  getLeetCodeFollowing,
  sleep,
  INTER_USER_DELAY_MS,
} from "./leetcode";
import { logger } from "./logger";

/** How often we run a full poll cycle, in milliseconds */
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1_000);

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

    // Also keep follows rows in sync for fast display in the follows list
    await db
      .update(followsTable)
      .set({
        displayName: profile.realName ?? null,
        avatarUrl: profile.userAvatar ?? null,
        totalSolved: profile.totalSolved ?? null,
        lastPolledAt: new Date(),
      })
      .where(eq(followsTable.leetcodeUsername, username));
  } else {
    // Still update lastPolledAt even if profile fetch failed
    await db
      .update(followsTable)
      .set({ lastPolledAt: new Date() })
      .where(eq(followsTable.leetcodeUsername, username));
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

  // 4. Persist new solved problems
  const rows = newSubmissions.map((s) => ({
    leetcodeUsername: username,
    problemSlug: s.titleSlug,
    problemTitle: s.title,
    difficulty: "Unknown",
    solvedAt: new Date(Number(s.timestamp) * 1_000),
  }));

  await db.insert(solvedProblemsTable).values(rows).onConflictDoNothing();

  // 5. Fetch all Clerk user IDs that follow this username
  const followers = await db
    .select({ userId: followsTable.userId })
    .from(followsTable)
    .where(eq(followsTable.leetcodeUsername, username));

  if (!followers.length) return;

  // 6. Create an in-app notification for each follower × each new problem
  const notifications = followers.flatMap(({ userId }) =>
    newSubmissions.map((s) => ({
      userId,
      message: `${username} solved "${s.title}"`,
      type: "solve",
      leetcodeUsername: username,
      problemTitle: s.title,
      problemSlug: s.titleSlug,
      difficulty: "Unknown",
      read: false,
      solvedAt: new Date(Number(s.timestamp) * 1_000),
    })),
  );

  await db.insert(notificationsTable).values(notifications);

  logger.info(
    { username, followers: followers.length, problems: newSubmissions.length },
    "Notifications dispatched",
  );
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
