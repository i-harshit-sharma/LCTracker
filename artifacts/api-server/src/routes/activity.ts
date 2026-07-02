/**
 * activity.ts — REST routes for the activity feed and analytics
 *
 * GET /api/activity              recent problems solved by followed users
 * GET /api/activity/stats        aggregate counts for today + this week
 * GET /api/activity/leaderboard  followed users ranked by weekly solve count
 */

import { Router, type IRouter } from "express";

import {
  db,
  followsTable,
  solvedProblemsTable,
  leetcodeProfilesTable,
  eq,
  desc,
  gte,
  lt,
  inArray,
  and,
  sql,
} from "@workspace/db";
import {
  ListActivityResponse,
  ListActivityQueryParams,
  GetActivityStatsResponse,
  GetLeaderboardResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import posthog from "../lib/posthog";

const router: IRouter = Router();

router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const qp = ListActivityQueryParams.safeParse(req.query);
  const limit = qp.success && qp.data.limit ? Math.min(qp.data.limit, 100) : 50;
  const myUsername =
    qp.success && qp.data.myUsername ? qp.data.myUsername : null;

  // Get all usernames followed by this user
  const followed = await db
    .select({ leetcodeUsername: followsTable.leetcodeUsername })
    .from(followsTable)
    .where(eq(followsTable.userId, userId));

  const usernames = followed.map((f) => f.leetcodeUsername);
  if (myUsername && !usernames.includes(myUsername)) {
    usernames.push(myUsername);
  }

  if (!usernames.length) {
    res.json([]);
    return;
  }

  const solves = await db
    .select({
      id: solvedProblemsTable.id,
      leetcodeUsername: solvedProblemsTable.leetcodeUsername,
      problemSlug: solvedProblemsTable.problemSlug,
      problemTitle: solvedProblemsTable.problemTitle,
      difficulty: solvedProblemsTable.difficulty,
      solvedAt: solvedProblemsTable.solvedAt,
      submissionId: solvedProblemsTable.submissionId,
      avatarUrl: leetcodeProfilesTable.avatarUrl,
      displayName: leetcodeProfilesTable.displayName,
    })
    .from(solvedProblemsTable)
    .leftJoin(
      leetcodeProfilesTable,
      eq(solvedProblemsTable.leetcodeUsername, leetcodeProfilesTable.username),
    )
    .where(inArray(solvedProblemsTable.leetcodeUsername, usernames))
    .orderBy(desc(solvedProblemsTable.solvedAt))
    .limit(limit);

  res.json(ListActivityResponse.parse(serializeDates(solves)));

  posthog.capture({
    distinctId: userId,
    event: "Activity Feed Viewed",
    properties: {
      count: solves.length,
      limit,
    },
  });
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
  const day = startOfToday.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // if Sunday, go back 6 to Monday
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfToday.getUTCDate() - diff);

  // Count today's unique solves
  const todayRows = await db
    .select({
      count: sql<number>`count(distinct ${solvedProblemsTable.problemSlug})::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfToday),
      ),
    );

  // Count this week's unique solves
  const weekRows = await db
    .select({
      count: sql<number>`count(distinct ${solvedProblemsTable.problemSlug})::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    );

  // Most common difficulty this week (based on unique problems)
  const diffRows = await db
    .select({
      difficulty: solvedProblemsTable.difficulty,
      count: sql<number>`count(distinct ${solvedProblemsTable.problemSlug})::int`,
    })
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    )
    .groupBy(solvedProblemsTable.difficulty)
    .orderBy(desc(sql`count(distinct ${solvedProblemsTable.problemSlug})`))
    .limit(1);

  // Most active user this week
  const activeRows = await db
    .select({
      leetcodeUsername: solvedProblemsTable.leetcodeUsername,
      displayName: leetcodeProfilesTable.displayName,
      count: sql<number>`count(distinct ${solvedProblemsTable.problemSlug})::int`,
    })
    .from(solvedProblemsTable)
    .leftJoin(
      leetcodeProfilesTable,
      eq(solvedProblemsTable.leetcodeUsername, leetcodeProfilesTable.username),
    )
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, usernames),
        gte(solvedProblemsTable.solvedAt, startOfWeek),
      ),
    )
    .groupBy(
      solvedProblemsTable.leetcodeUsername,
      leetcodeProfilesTable.displayName,
    )
    .orderBy(desc(sql`count(distinct ${solvedProblemsTable.problemSlug})`))
    .limit(1);

  res.json(
    GetActivityStatsResponse.parse({
      solvedToday: todayRows[0]?.count ?? 0,
      solvedThisWeek: weekRows[0]?.count ?? 0,
      topDifficulty: diffRows[0]?.difficulty ?? "None",
      mostActiveUser: activeRows[0]?.leetcodeUsername ?? null,
      mostActiveDisplayName: activeRows[0]?.displayName ?? null,
    }),
  );

  posthog.capture({
    distinctId: userId,
    event: "Stats Viewed",
  });
});

router.get(
  "/activity/leaderboard",
  requireAuth,
  async (req, res): Promise<void> => {
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
          displayName: leetcodeProfilesTable.displayName,
          avatarUrl: leetcodeProfilesTable.avatarUrl,
          totalSolved: leetcodeProfilesTable.totalSolved,
        })
        .from(followsTable)
        .leftJoin(
          leetcodeProfilesTable,
          eq(followsTable.leetcodeUsername, leetcodeProfilesTable.username),
        )
        .where(eq(followsTable.userId, userId));

      users = followed;
    }

    if (!users.length) {
      res.json([]);
      return;
    }

    const usernames = users.map((u) => u.leetcodeUsername);

    // ── Fetch per-user timing data for lastSolvedAt & avgTimeBetweenSolves ──
    const lastSolvedRows = await db
      .select({
        leetcodeUsername: solvedProblemsTable.leetcodeUsername,
        lastSolvedAt: sql<string>`max(${solvedProblemsTable.solvedAt})`,
      })
      .from(solvedProblemsTable)
      .where(inArray(solvedProblemsTable.leetcodeUsername, usernames))
      .groupBy(solvedProblemsTable.leetcodeUsername);

    const lastSolvedMap = new Map(
      lastSolvedRows.map((r) => [r.leetcodeUsername, r.lastSolvedAt]),
    );

    // Fetch recent solve timestamps (last 90 days) to compute average interval
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentSolves = await db
      .select({
        leetcodeUsername: solvedProblemsTable.leetcodeUsername,
        solvedAt: solvedProblemsTable.solvedAt,
      })
      .from(solvedProblemsTable)
      .where(
        and(
          inArray(solvedProblemsTable.leetcodeUsername, usernames),
          gte(solvedProblemsTable.solvedAt, ninetyDaysAgo),
        ),
      )
      .orderBy(
        solvedProblemsTable.leetcodeUsername,
        solvedProblemsTable.solvedAt,
      );

    // Group solve timestamps by user and compute average interval in hours
    const avgTimeMap = new Map<string, number>();
    const groupedSolves = new Map<string, Date[]>();
    for (const row of recentSolves) {
      const ts =
        row.solvedAt instanceof Date ? row.solvedAt : new Date(row.solvedAt);
      if (!groupedSolves.has(row.leetcodeUsername)) {
        groupedSolves.set(row.leetcodeUsername, []);
      }
      groupedSolves.get(row.leetcodeUsername)!.push(ts);
    }
    for (const [username, timestamps] of groupedSolves) {
      if (timestamps.length >= 2) {
        let totalDiffMs = 0;
        for (let i = 1; i < timestamps.length; i++) {
          totalDiffMs += timestamps[i].getTime() - timestamps[i - 1].getTime();
        }
        const avgHours =
          totalDiffMs / (timestamps.length - 1) / (1000 * 60 * 60);
        avgTimeMap.set(username, Math.round(avgHours * 100) / 100);
      }
    }

    // For "all" period sort by totalSolved from profile data (no DB count needed)
    if (period === "all") {
      const leaderboard = users
        .map((u) => ({
          leetcodeUsername: u.leetcodeUsername,
          displayName: u.displayName ?? null,
          avatarUrl: u.avatarUrl ?? null,
          totalSolved: u.totalSolved ?? null,
          solvedInPeriod: u.totalSolved ?? 0,
          lastSolvedAt: lastSolvedMap.get(u.leetcodeUsername) ?? null,
          avgTimeBetweenSolves: avgTimeMap.get(u.leetcodeUsername) ?? null,
        }))
        .sort((a, b) => b.solvedInPeriod - a.solvedInPeriod)
        .slice(0, 50);

      res.json(GetLeaderboardResponse.parse(serializeDates(leaderboard)));
      return;
    }

    // Compute period start in UTC
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date | null = null;

    if (period === "day") {
      // "Day" starts at 12:00 AM UTC
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
    } else if (typeof period === "string" && period.startsWith("week-")) {
      // Expected format: week-YYYY-MM-DD
      const datePart = period.replace("week-", "");
      const parsed = new Date(datePart);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid week date" });
        return;
      }
      periodStart = new Date(
        Date.UTC(
          parsed.getUTCFullYear(),
          parsed.getUTCMonth(),
          parsed.getUTCDate(),
        ),
      );
      periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
    } else {
      // "week" (default) — start of current Monday UTC
      const startOfToday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      periodStart = new Date(startOfToday);
      const day = periodStart.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // if Sunday, go back 6 to Monday
      periodStart.setUTCDate(periodStart.getUTCDate() - diff);
    }

    const dateFilters = [gte(solvedProblemsTable.solvedAt, periodStart)];
    if (periodEnd) {
      dateFilters.push(lt(solvedProblemsTable.solvedAt, periodEnd));
    }

    // Count solves per user within the selected period
    const periodCounts = await db
      .select({
        leetcodeUsername: solvedProblemsTable.leetcodeUsername,
        solvedInPeriod: sql<number>`count(distinct ${solvedProblemsTable.problemSlug})::int`,
      })
      .from(solvedProblemsTable)
      .where(
        and(
          inArray(solvedProblemsTable.leetcodeUsername, usernames),
          ...dateFilters,
        ),
      )
      .groupBy(solvedProblemsTable.leetcodeUsername);

    const countMap = new Map(
      periodCounts.map((r) => [r.leetcodeUsername, r.solvedInPeriod]),
    );

    const leaderboard = users
      .map((u) => ({
        leetcodeUsername: u.leetcodeUsername,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        totalSolved: u.totalSolved ?? null,
        solvedInPeriod: countMap.get(u.leetcodeUsername) ?? 0,
        lastSolvedAt: lastSolvedMap.get(u.leetcodeUsername) ?? null,
        avgTimeBetweenSolves: avgTimeMap.get(u.leetcodeUsername) ?? null,
      }))
      .sort((a, b) => b.solvedInPeriod - a.solvedInPeriod)
      .slice(0, 50);

    res.json(GetLeaderboardResponse.parse(serializeDates(leaderboard)));

    posthog.capture({
      distinctId: userId,
      event: "Leaderboard Viewed",
      properties: {
        scope,
        period,
        count: leaderboard.length,
      },
    });
  },
);

export default router;
