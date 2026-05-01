/**
 * activity.ts — REST routes for the activity feed and analytics
 *
 * GET /api/activity              recent problems solved by followed users
 * GET /api/activity/stats        aggregate counts for today + this week
 * GET /api/activity/leaderboard  followed users ranked by weekly solve count
 */

import { Router, type IRouter } from "express";
import { eq, desc, gte, inArray, and, sql } from "drizzle-orm";
import { db, followsTable, solvedProblemsTable, leetcodeProfilesTable } from "@workspace/db";
import {
  ListActivityResponse,
  ListActivityQueryParams,
  GetActivityStatsResponse,
  GetLeaderboardResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const qp = ListActivityQueryParams.safeParse(req.query);
  const limit = qp.success && qp.data.limit ? Math.min(qp.data.limit, 100) : 50;

  // Get all usernames followed by this user
  const followed = await db
    .select({ leetcodeUsername: followsTable.leetcodeUsername })
    .from(followsTable)
    .where(eq(followsTable.userId, userId));

  if (!followed.length) {
    res.json([]);
    return;
  }

  const usernames = followed.map((f) => f.leetcodeUsername);

  const solves = await db
    .select()
    .from(solvedProblemsTable)
    .where(inArray(solvedProblemsTable.leetcodeUsername, usernames))
    .orderBy(desc(solvedProblemsTable.solvedAt))
    .limit(limit);

  res.json(ListActivityResponse.parse(serializeDates(solves)));
});

router.get("/activity/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const followed = await db
    .select({ leetcodeUsername: followsTable.leetcodeUsername })
    .from(followsTable)
    .where(eq(followsTable.userId, userId));

  if (!followed.length) {
    res.json(
      GetActivityStatsResponse.parse({
        solvedToday: 0,
        solvedThisWeek: 0,
        topDifficulty: "None",
        mostActiveUser: null,
      }),
    );
    return;
  }

  const usernames = followed.map((f) => f.leetcodeUsername);

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());

  // Count today's solves
  const todayRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfToday),
      ),
    );

  // Count this week's solves
  const weekRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    );

  // Most common difficulty this week
  const diffRows = await db
    .select({
      difficulty: solvedProblemsTable.difficulty,
      count: sql<number>`count(*)::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    )
    .groupBy(solvedProblemsTable.difficulty)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  // Most active user this week
  const activeRows = await db
    .select({
      leetcodeUsername: solvedProblemsTable.leetcodeUsername,
      count: sql<number>`count(*)::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    )
    .groupBy(solvedProblemsTable.leetcodeUsername)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  res.json(
    GetActivityStatsResponse.parse({
      solvedToday: todayRows[0]?.count ?? 0,
      solvedThisWeek: weekRows[0]?.count ?? 0,
      topDifficulty: diffRows[0]?.difficulty ?? "None",
      mostActiveUser: activeRows[0]?.leetcodeUsername ?? null,
    }),
  );
});

router.get("/activity/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const { scope = "following" } = req.query;

  let users: {
    leetcodeUsername: string;
    displayName: string | null;
    avatarUrl: string | null;
    totalSolved: number | null;
  }[] = [];

  if (scope === "global") {
    // Get all users from profiles table
    const allProfiles = await db
      .select({
        leetcodeUsername: leetcodeProfilesTable.username,
        displayName: leetcodeProfilesTable.displayName,
        avatarUrl: leetcodeProfilesTable.avatarUrl,
        totalSolved: leetcodeProfilesTable.totalSolved,
      })
      .from(leetcodeProfilesTable);

    users = allProfiles;
  } else {
    // Default: followed users
    const followed = await db
      .select({
        leetcodeUsername: followsTable.leetcodeUsername,
        displayName: followsTable.displayName,
        avatarUrl: followsTable.avatarUrl,
        totalSolved: followsTable.totalSolved,
      })
      .from(followsTable)
      .where(eq(followsTable.userId, userId));

    users = followed;
  }

  if (!users.length) {
    res.json([]);
    return;
  }

  const usernames = users.map((u) => u.leetcodeUsername);

  const now = new Date();
  const startOfWeek = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());

  // Count weekly solves per username
  const weeklyCounts = await db
    .select({
      leetcodeUsername: solvedProblemsTable.leetcodeUsername,
      solvedThisWeek: sql<number>`count(*)::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    )
    .groupBy(solvedProblemsTable.leetcodeUsername);

  const countMap = new Map(weeklyCounts.map((r) => [r.leetcodeUsername, r.solvedThisWeek]));

  // Merge with user metadata and sort by weekly count desc
  const leaderboard = users
    .map((u) => ({
      leetcodeUsername: u.leetcodeUsername,
      displayName: u.displayName ?? null,
      avatarUrl: u.avatarUrl ?? null,
      totalSolved: u.totalSolved ?? null,
      solvedThisWeek: countMap.get(u.leetcodeUsername) ?? 0,
    }))
    .sort((a, b) => b.solvedThisWeek - a.solvedThisWeek)
    .slice(0, 50); // Limit to top 50 for performance

  res.json(GetLeaderboardResponse.parse(serializeDates(leaderboard)));
});

export default router;
