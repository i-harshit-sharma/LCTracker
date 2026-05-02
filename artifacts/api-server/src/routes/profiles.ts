/**
 * profiles.ts — REST routes for LeetCode profile data
 *
 * GET /api/profiles/:username
 *
 * Serves profile data entirely from the DB (leetcode_profiles + solved_problems).
 * Falls back to a live LeetCode fetch only when the username has never been
 * polled before, then stores the result so subsequent requests are DB-only.
 *
 * The `following` field is parsed from the cached followingJson column.
 *
 * GET /api/profiles/:username/db-summary
 *
 * DB-only read. Never touches the live LeetCode API, never inserts into
 * leetcode_profiles. Returns null (404) if the user hasn't been crawled yet.
 * Used by the leaderboard to show the viewer's own row without polluting the
 * global profiles table.
 */

import { Router, type IRouter } from "express";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { db, solvedProblemsTable, leetcodeProfilesTable } from "@workspace/db";
import { GetLeetcodeProfileParams, GetLeetcodeProfileResponse, GetDbProfileSummaryResponse } from "@workspace/api-zod";
import { getLeetCodeProfile, getLeetCodeFollowing } from "../lib/leetcode";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import type { LCFollowingEntry } from "../lib/leetcode";

const router: IRouter = Router();

router.get("/profiles/:username", requireAuth, async (req, res): Promise<void> => {
  const rawUsername = Array.isArray(req.params.username)
    ? req.params.username[0]
    : req.params.username;

  const params = GetLeetcodeProfileParams.safeParse({ username: rawUsername });
  if (!params.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const { username } = params.data;

  // 1. Try the shared profile cache first
  const [cachedProfile] = await db
    .select()
    .from(leetcodeProfilesTable)
    .where(eq(leetcodeProfilesTable.username, username))
    .limit(1);

  let profileData = cachedProfile ?? null;

  // 2. If no cache entry exists yet, do a live fetch and persist it
  if (!profileData) {
    const [live, liveFollowing] = await Promise.all([
      getLeetCodeProfile(username),
      getLeetCodeFollowing(username, 30),
    ]);

    if (!live) {
      res.status(404).json({ error: "LeetCode profile not found" });
      return;
    }

    const [inserted] = await db
      .insert(leetcodeProfilesTable)
      .values({
        username,
        displayName: live.realName ?? null,
        avatarUrl: live.userAvatar ?? null,
        totalSolved: live.totalSolved ?? null,
        easySolved: live.easySolved ?? null,
        mediumSolved: live.mediumSolved ?? null,
        hardSolved: live.hardSolved ?? null,
        followingJson: liveFollowing.length ? JSON.stringify(liveFollowing) : null,
        lastPolledAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leetcodeProfilesTable.username,
        set: {
          displayName: live.realName ?? null,
          avatarUrl: live.userAvatar ?? null,
          totalSolved: live.totalSolved ?? null,
          easySolved: live.easySolved ?? null,
          mediumSolved: live.mediumSolved ?? null,
          hardSolved: live.hardSolved ?? null,
          followingJson: liveFollowing.length ? JSON.stringify(liveFollowing) : null,
          lastPolledAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    profileData = inserted;
  }

  // 3. Parse the cached following list (stored as JSON string)
  let following: LCFollowingEntry[] = [];
  if (profileData.followingJson) {
    try {
      following = JSON.parse(profileData.followingJson) as LCFollowingEntry[];
    } catch {
      following = [];
    }
  }

  // 4. Fetch stored solved problems from our DB (most recent 20)
  const recentProblems = await db
    .select()
    .from(solvedProblemsTable)
    .where(eq(solvedProblemsTable.leetcodeUsername, username))
    .orderBy(desc(solvedProblemsTable.solvedAt))
    .limit(20);

  res.json(
    GetLeetcodeProfileResponse.parse(
      serializeDates({
        leetcodeUsername: profileData.username,
        displayName: profileData.displayName ?? null,
        avatarUrl: profileData.avatarUrl ?? null,
        totalSolved: profileData.totalSolved ?? null,
        easySolved: profileData.easySolved ?? null,
        mediumSolved: profileData.mediumSolved ?? null,
        hardSolved: profileData.hardSolved ?? null,
        recentProblems,
        following,
      }),
    ),
  );
});

/**
 * GET /api/profiles/:username/db-summary
 *
 * DB-only lookup — never calls the LeetCode API, never inserts a row.
 * Returns 404 if the username hasn't been crawled yet.
 * Accepts ?period=day|week|month|year|all (default: week) to return
 * solvedInPeriod alongside the basic profile data.
 */
router.get("/profiles/:username/db-summary", requireAuth, async (req, res): Promise<void> => {
  const rawUsername = Array.isArray(req.params.username)
    ? req.params.username[0]
    : req.params.username;

  const username = rawUsername?.trim();
  if (!username) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  // Read profile from cache — no live fetch, no write
  const [cachedProfile] = await db
    .select()
    .from(leetcodeProfilesTable)
    .where(eq(leetcodeProfilesTable.username, username))
    .limit(1);

  if (!cachedProfile) {
    res.status(404).json({ error: "Not in database yet" });
    return;
  }

  // Compute period start
  const period = (req.query.period as string) ?? "week";
  const now = new Date();
  let periodStart: Date | null = null;

  if (period === "day") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (period === "week") {
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    periodStart = new Date(startOfToday);
    periodStart.setUTCDate(periodStart.getUTCDate() - periodStart.getUTCDay());
  } else if (period === "month") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (period === "year") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  // period === "all" → periodStart stays null → count all

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(solvedProblemsTable)
    .where(
      periodStart
        ? and(
            eq(solvedProblemsTable.leetcodeUsername, username),
            gte(solvedProblemsTable.solvedAt, periodStart),
          )
        : eq(solvedProblemsTable.leetcodeUsername, username),
    );

  const solvedInPeriod = countRows[0]?.count ?? 0;

  res.json(
    GetDbProfileSummaryResponse.parse(
      serializeDates({
        leetcodeUsername: cachedProfile.username,
        displayName: cachedProfile.displayName ?? null,
        avatarUrl: cachedProfile.avatarUrl ?? null,
        totalSolved: cachedProfile.totalSolved ?? null,
        solvedInPeriod,
        inDatabase: true,
      }),
    ),
  );
});

/**
 * POST /api/profiles/:username/save
 *
 * One-shot fetch from LeetCode and upsert into leetcode_profiles.
 * Does NOT create a follow row — the user won't be added to the global
 * polling pool. This lets a viewer seed their own profile so the
 * /db-summary endpoint can return data without making them "followed".
 */
router.post("/profiles/:username/save", requireAuth, async (req, res): Promise<void> => {
  const rawUsername = Array.isArray(req.params.username)
    ? req.params.username[0]
    : req.params.username;

  const username = rawUsername?.trim();
  if (!username) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const [live, liveFollowing] = await Promise.all([
    getLeetCodeProfile(username),
    getLeetCodeFollowing(username, 30),
  ]);

  if (!live) {
    res.status(404).json({ error: "LeetCode profile not found" });
    return;
  }

  const [upserted] = await db
    .insert(leetcodeProfilesTable)
    .values({
      username,
      displayName: live.realName ?? null,
      avatarUrl: live.userAvatar ?? null,
      totalSolved: live.totalSolved ?? null,
      easySolved: live.easySolved ?? null,
      mediumSolved: live.mediumSolved ?? null,
      hardSolved: live.hardSolved ?? null,
      followingJson: liveFollowing.length ? JSON.stringify(liveFollowing) : null,
      lastPolledAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: leetcodeProfilesTable.username,
      set: {
        displayName: live.realName ?? null,
        avatarUrl: live.userAvatar ?? null,
        totalSolved: live.totalSolved ?? null,
        easySolved: live.easySolved ?? null,
        mediumSolved: live.mediumSolved ?? null,
        hardSolved: live.hardSolved ?? null,
        followingJson: liveFollowing.length ? JSON.stringify(liveFollowing) : null,
        lastPolledAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(
    GetDbProfileSummaryResponse.parse(
      serializeDates({
        leetcodeUsername: upserted.username,
        displayName: upserted.displayName ?? null,
        avatarUrl: upserted.avatarUrl ?? null,
        totalSolved: upserted.totalSolved ?? null,
        solvedInPeriod: 0,
        inDatabase: true,
      }),
    ),
  );
});

export default router;
