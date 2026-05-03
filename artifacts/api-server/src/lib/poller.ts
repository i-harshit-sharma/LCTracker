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

import { db, followsTable, leetcodeProfilesTable, solvedProblemsTable, notificationsTable, scannerMetadataTable, eq, inArray, and } from "@workspace/db";

import {
  getRecentAcceptedSubmissions,
  getLeetCodeProfile,
  getLeetCodeFollowing,
  getProblemDifficulty,
  getSubmissionDetails,
  getLatestSubmissionId,
  LeetCodeAuthError,
  sleep,
  INTER_USER_DELAY_MS,
  type LCSubmission,
} from "./leetcode";
import { logger } from "./logger";
import { sendPushNotificationsForUser } from "./pushNotification";
import posthog from "./posthog";

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
  
  const startTime = Date.now();
  posthog.capture({
    distinctId: "api-server",
    event: "Poll Cycle Started",
  });

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

    // 2. Run the global brute-force scanner to catch missing private solves
    try {
      await runGlobalScanner();
    } catch (err) {
      if (err instanceof LeetCodeAuthError) {
        // Already handled/captured in PostHog
      } else {
        logger.error({ err }, "Unhandled error in global scanner");
      }
    }

    logger.info("Poll cycle complete");
    posthog.capture({
      distinctId: "api-server",
      event: "Poll Cycle Completed",
      properties: {
        durationMs: Date.now() - startTime,
        usernamesCount: usernames.length,
      },
    });
  } catch (err) {
    posthog.capture({
      distinctId: "api-server",
      event: "Poll Cycle Failed",
      properties: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
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
  const [submissions, profile, following, oldProfile] = await Promise.all([
    getRecentAcceptedSubmissions(username, 20),
    getLeetCodeProfile(username),
    getLeetCodeFollowing(username, 30),
    db
      .select()
      .from(leetcodeProfilesTable)
      .where(eq(leetcodeProfilesTable.username, username))
      .limit(1)
      .then((rows) => rows[0]),
    getLatestSubmissionId(),
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

  // 3. Check which slugs we've already stored (to find genuinely new ones)
  const slugs = submissions.map((s) => s.titleSlug);
  const existing =
    slugs.length > 0
      ? await db
          .select({ problemSlug: solvedProblemsTable.problemSlug })
          .from(solvedProblemsTable)
          .where(
            and(
              eq(solvedProblemsTable.leetcodeUsername, username),
              inArray(solvedProblemsTable.problemSlug, slugs),
            ),
          )
      : [];

  const existingSlugs = new Set(existing.map((r) => r.problemSlug));
  const newSubmissions = submissions.filter((s) => !existingSlugs.has(s.titleSlug));

  // Identify "Unknown" solves if profile counts increased more than the submissions we found
  const allNewSubmissions = [...newSubmissions];
  if (profile && oldProfile) {
    const diffs = [
      { key: "easySolved" as const, difficulty: "Easy" },
      { key: "mediumSolved" as const, difficulty: "Medium" },
      { key: "hardSolved" as const, difficulty: "Hard" },
    ];

    // Fetch difficulties for the new public submissions so we can compare counts
    const newWithDiff = await Promise.all(
      newSubmissions.map(async (s) => ({
        ...s,
        difficulty: await getProblemDifficulty(s.titleSlug),
      })),
    );

    const missingByDifficulty: Record<string, number> = {};
    let totalMissing = 0;

    for (const { key, difficulty } of diffs) {
      const newVal = profile[key] ?? 0;
      const oldVal = oldProfile[key] ?? 0;
      const delta = newVal - oldVal;
      const foundCount = newWithDiff.filter((s) => s.difficulty === difficulty).length;

      if (delta > foundCount) {
        const count = delta - foundCount;
        missingByDifficulty[difficulty] = count;
        totalMissing += count;
        logger.info(
          { username, difficulty, count },
          "Detected unknown solves via profile count",
        );
      }
    }

    if (totalMissing > 0) {
      for (const [difficulty, count] of Object.entries(missingByDifficulty)) {
        for (let i = 0; i < count; i++) {
          const ts = Math.floor(Date.now() / 1000);
          allNewSubmissions.push({
            id: `private-${difficulty.toLowerCase()}-${ts}-${i}`,
            title: `Private ${difficulty} Problem`,
            titleSlug: `private-${difficulty.toLowerCase()}-${ts}-${i}`,
            timestamp: ts.toString(),
          });
        }
      }
    }
  }



  if (!allNewSubmissions.length) {
    logger.debug({ username }, "No new solved problems detected");
    return;
  }

  logger.info(
    { username, count: allNewSubmissions.length },
    "New solved problems detected",
  );

  posthog.capture({
    distinctId: username,
    event: "New Solved Problems Detected",
    properties: {
      count: allNewSubmissions.length,
      problems: allNewSubmissions.map(s => s.title),
    },
  });

  // 4. Persist new solved problems (shared helper used by backfill too)
  const rows = await persistNewSubmissions(username, allNewSubmissions);

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
        submissionId: row.submissionId,
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

  posthog.capture({
    distinctId: username,
    event: "Notifications Dispatched",
    properties: {
      followersCount: followers.length,
      problemsCount: recentRows.length,
    },
  });

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
  newSubmissions: LCSubmission[],
) {
  const CHUNK_SIZE = 10;
  const rows = [];
  
  for (let i = 0; i < newSubmissions.length; i += CHUNK_SIZE) {
    const chunk = newSubmissions.slice(i, i + CHUNK_SIZE);
    const chunkRows = await Promise.all(
      chunk.map(async (s) => {
        let difficulty: string;
        if (s.titleSlug.startsWith("private-")) {
          // Extract "Easy", "Medium", or "Hard" from "private-easy-..."
          const part = s.titleSlug.split("-")[1];
          difficulty = part.charAt(0).toUpperCase() + part.slice(1);
        } else {
          difficulty = await getProblemDifficulty(s.titleSlug);
        }

        return {
          leetcodeUsername: username,
          problemSlug: s.titleSlug,
          problemTitle: s.title,
          difficulty,
          submissionId: s.id.startsWith("private-") ? null : s.id,
          solvedAt: new Date(Number(s.timestamp) * 1_000),
        };
      }),
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
  // Step 2 — filter out slugs already stored in the DB
  const slugs = submissions.map((s) => s.titleSlug);
  const existing =
    slugs.length > 0
      ? await db
          .select({ problemSlug: solvedProblemsTable.problemSlug })
          .from(solvedProblemsTable)
          .where(
            and(
              eq(solvedProblemsTable.leetcodeUsername, username),
              inArray(solvedProblemsTable.problemSlug, slugs),
            ),
          )
      : [];

  const existingSlugs = new Set(existing.map((r) => r.problemSlug));
  const newSubmissions = submissions.filter((s) => !existingSlugs.has(s.titleSlug));

  // Identify "Unknown" solves for backfill (if profile counts > found submissions)
  const allSubmissions = [...newSubmissions];
  if (profile) {
    const diffs = [
      { key: "easySolved" as const, difficulty: "Easy" },
      { key: "mediumSolved" as const, difficulty: "Medium" },
      { key: "hardSolved" as const, difficulty: "Hard" },
    ];

    // We need to know which problems we ALREADY have to accurately count the gap
    const dbSolves = await db
      .select({ difficulty: solvedProblemsTable.difficulty, slug: solvedProblemsTable.problemSlug })
      .from(solvedProblemsTable)
      .where(eq(solvedProblemsTable.leetcodeUsername, username));

    const newWithDiff = await Promise.all(
      newSubmissions.map(async (s) => ({
        ...s,
        difficulty: await getProblemDifficulty(s.titleSlug),
      })),
    );

    for (const { key, difficulty } of diffs) {
      const targetCount = profile[key] ?? 0;
      const currentFoundCount =
        dbSolves.filter((s) => s.difficulty === difficulty).length +
        newWithDiff.filter((s) => s.difficulty === difficulty).length;

      if (targetCount > currentFoundCount) {
        const unknownToAdd = targetCount - currentFoundCount;
        logger.info(
          { username, difficulty, count: unknownToAdd },
          "Adding unknown solves during backfill",
        );
        for (let i = 0; i < unknownToAdd; i++) {
          // For historical backfill, we use Unix epoch 0 so these don't pollute "this week" stats
          const ts = 0;
          allSubmissions.push({
            id: `private-${difficulty.toLowerCase()}-${ts}-${i}`,
            title: `Private ${difficulty} Problem`,
            titleSlug: `private-${difficulty.toLowerCase()}-${ts}-${i}`,
            timestamp: ts.toString(),
          });
        }
      }
    }
  }

  if (!allSubmissions.length) {
    logger.info({ username }, "All submissions already stored — backfill skipped");
    return;
  }

  // Step 3 — persist everything that is genuinely new
  const rows = await persistNewSubmissions(username, allSubmissions);
  logger.info(
    { username, stored: rows.length, total: submissions.length },
    "Backfill complete",
  );
}

/**
 * Updates the persistent scanner progress in the database.
 */
async function updateLastScannedId(id: number) {
  await db
    .insert(scannerMetadataTable)
    .values({
      key: "last_scanned_id",
      value: id.toString(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: scannerMetadataTable.key,
      set: {
        value: id.toString(),
        updatedAt: new Date(),
      },
    });
}

/**
 * Global brute-force scanner that checks individual submission IDs.
 * This identifies solves for any tracked user, even if their profile is private.
 */
async function runGlobalScanner(): Promise<void> {
  const sessionToken = process.env.LEETCODE_SESSION;
  const csrfToken = process.env.LEETCODE_CSRF_TOKEN;

  if (!sessionToken || !csrfToken) {
    logger.debug("Scanner skipped: LEETCODE_SESSION or LEETCODE_CSRF_TOKEN missing");
    return;
  }

  try {
    // 1. Get last scanned ID from DB
    const meta = await db
      .select()
      .from(scannerMetadataTable)
      .where(eq(scannerMetadataTable.key, "last_scanned_id"))
      .limit(1)
      .then((rows) => rows[0]);

    const START_ID_DEFAULT = 1994457170;
    let lastId = meta ? parseInt(meta.value, 10) : START_ID_DEFAULT;

    // 2. Get current latest ID from LeetCode
    const currentMaxId = await getLatestSubmissionId();
    if (!currentMaxId) return;

    if (currentMaxId <= lastId) {
      logger.debug({ lastId, currentMaxId }, "Scanner: No new submissions to scan");
      return;
    }

    logger.info({ from: lastId, to: currentMaxId }, "Scanner: Starting scan range");

    // 3. Gather every unique LeetCode username that anyone is following
    const followRows = await db
      .selectDistinct({ leetcodeUsername: followsTable.leetcodeUsername })
      .from(followsTable);
    const trackedUsernames = new Set(followRows.map((r) => r.leetcodeUsername.toLowerCase()));

    if (trackedUsernames.size === 0) return;

    // 4. Scan IDs in chunks
    const MAX_IDS_PER_CYCLE = 3000;
    let processedCount = 0;

    for (let id = lastId + 1; id <= currentMaxId && processedCount < MAX_IDS_PER_CYCLE; id++) {
      try {
        const details = await getSubmissionDetails(id);
        if (details && details.statusCode === 10) {
          const username = details.user.username.toLowerCase();
          if (trackedUsernames.has(username)) {
            logger.info({ id, username, problem: details.question.titleSlug }, "Scanner found a solve!");
            await handleScannerFoundSolve(details.user.username, {
              id: id.toString(),
              title: details.question.title,
              titleSlug: details.question.titleSlug,
              timestamp: details.timestamp.toString(),
            });
          }
        }
      } catch (err) {
        if (err instanceof LeetCodeAuthError) {
          posthog.capture({
            distinctId: "api-server",
            event: "LeetCode Token Expired",
            properties: { error: err.message },
          });
          logger.error({ err }, "Scanner halted: Token expired");
          throw err;
        }
        logger.warn({ id, err }, "Scanner failed to check ID");
      }

      processedCount++;
      // Batch progress update
      if (processedCount % 50 === 0) {
        await updateLastScannedId(id);
      }

      // Speed control: fast catch-up if far behind
      const diff = currentMaxId - id;
      if (diff > 500) {
        await sleep(50); // Catch-up mode
      } else {
        await sleep(200); // Slow mode as we approach real-time
      }
    }

    await updateLastScannedId(lastId + processedCount);
    logger.info({ processedCount }, "Scanner cycle complete");
  } catch (err) {
    if (err instanceof LeetCodeAuthError) throw err;
    logger.error({ err }, "Global scanner loop failed");
  }
}

/**
 * Processes a single solve identified by the global scanner.
 * Stores the problem and sends notifications.
 */
async function handleScannerFoundSolve(username: string, submission: LCSubmission) {
  const difficulty = await getProblemDifficulty(submission.titleSlug);

  const row = {
    leetcodeUsername: username,
    problemSlug: submission.titleSlug,
    problemTitle: submission.title,
    difficulty,
    submissionId: submission.id,
    solvedAt: new Date(Number(submission.timestamp) * 1000),
  };

  // 1. Store the solve
  const inserted = await db
    .insert(solvedProblemsTable)
    .values(row)
    .onConflictDoNothing()
    .returning();

  if (!inserted.length) return; // Already exists

  // 2. Fetch followers and notify
  const followers = await db
    .select({ userId: followsTable.userId })
    .from(followsTable)
    .where(eq(followsTable.leetcodeUsername, username));

  if (!followers.length) return;

  const notifications = followers.map((f) => ({
    userId: f.userId,
    message: `${username} solved "${row.problemTitle}"`,
    type: "solve" as const,
    leetcodeUsername: username,
    problemTitle: row.problemTitle,
    problemSlug: row.problemSlug,
    difficulty: row.difficulty,
    submissionId: row.submissionId,
    read: false,
    solvedAt: row.solvedAt,
  }));

  await db.insert(notificationsTable).values(notifications);

  // Browser push notifications
  await Promise.all(
    followers.map((f) =>
      sendPushNotificationsForUser(f.userId, {
        title: `🔥 ${username} solved "${row.problemTitle}"`,
        body: `They're on a roll! Check it out.`,
        url: `https://leetcode.com/problems/${row.problemSlug}/`,
        icon: "/logo.svg",
      }),
    ),
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
