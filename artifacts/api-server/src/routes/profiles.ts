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
 */

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, solvedProblemsTable, leetcodeProfilesTable } from "@workspace/db";
import { GetLeetcodeProfileParams, GetLeetcodeProfileResponse } from "@workspace/api-zod";
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

export default router;
