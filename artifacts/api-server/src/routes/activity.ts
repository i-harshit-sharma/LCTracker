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
  const { scope = "following", period = "week" } = req.query;

  let users: {
    leetcodeUsername: string;
    displayName: string | null;
    avatarUrl: string | null;
    totalSolved: number | null;
  }[] = [];

  if (scope === "global") {
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

  // For "all" period sort by totalSolved from profile data (no DB count needed)
  if (period === "all") {
    const leaderboard = users
      .map((u) => ({
        leetcodeUsername: u.leetcodeUsername,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        totalSolved: u.totalSolved ?? null,
        solvedInPeriod: u.totalSolved ?? 0,
      }))
      .sort((a, b) => b.solvedInPeriod - a.solvedInPeriod)
      .slice(0, 50);

    res.json(GetLeaderboardResponse.parse(serializeDates(leaderboard)));
    return;
  }

  // Compute period start in UTC
  const now = new Date();
  let periodStart: Date;

  if (period === "day") {
    // "Day" starts at 12:00 AM IST (UTC+5:30 = 330 minutes ahead of UTC).
    // IST midnight = UTC 18:30 the *previous* day.
    // Strategy: find the current date in IST, then express IST midnight as a UTC timestamp.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 330 min in ms
    const nowInIST = new Date(now.getTime() + IST_OFFSET_MS);
    // Midnight of the current IST day (in IST "clock time")
    const istMidnight = new Date(
      Date.UTC(nowInIST.getUTCFullYear(), nowInIST.getUTCMonth(), nowInIST.getUTCDate()),
    );
    // Shift back to UTC: subtract the IST offset so the timestamp points to IST midnight
    periodStart = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  } else if (period === "month") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (period === "year") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    // "week" (default) — start of current Sunday UTC
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    periodStart = new Date(startOfToday);
    periodStart.setUTCDate(periodStart.getUTCDate() - periodStart.getUTCDay());
  }

  // Count solves per user within the selected period
  const periodCounts = await db
    .select({
      leetcodeUsername: solvedProblemsTable.leetcodeUsername,
      solvedInPeriod: sql<number>`count(*)::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, periodStart),
      ),
    )
    .groupBy(solvedProblemsTable.leetcodeUsername);

  const countMap = new Map(periodCounts.map((r) => [r.leetcodeUsername, r.solvedInPeriod]));

  const leaderboard = users
    .map((u) => ({
      leetcodeUsername: u.leetcodeUsername,
      displayName: u.displayName ?? null,
      avatarUrl: u.avatarUrl ?? null,
      totalSolved: u.totalSolved ?? null,
      solvedInPeriod: countMap.get(u.leetcodeUsername) ?? 0,
    }))
    .sort((a, b) => b.solvedInPeriod - a.solvedInPeriod)
    .slice(0, 50);

  res.json(GetLeaderboardResponse.parse(serializeDates(leaderboard)));
});

export default router;
