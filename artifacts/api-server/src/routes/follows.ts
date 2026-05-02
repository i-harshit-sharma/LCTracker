/**
 * follows.ts — REST routes for managing follow relationships
 *
 * GET    /api/follows          list all profiles the current user follows
 * POST   /api/follows          follow a new LeetCode username
 * DELETE /api/follows/:id      unfollow (remove a follow row by its PK)
 */

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, followsTable, leetcodeProfilesTable } from "@workspace/db";
import {
  ListFollowsResponse,
  CreateFollowBody,
  DeleteFollowParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { getLeetCodeProfile } from "../lib/leetcode";
import { serializeDates } from "../lib/serialize";
import { backfillUserProblems } from "../lib/poller";

const router: IRouter = Router();

router.get("/follows", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const follows = await db
    .select()
    .from(followsTable)
    .where(eq(followsTable.userId, userId))
    .orderBy(desc(followsTable.createdAt));

  res.json(ListFollowsResponse.parse(serializeDates(follows)));
});

router.post("/follows", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const parsed = CreateFollowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { leetcodeUsername } = parsed.data;

  // Prevent duplicate follows
  const existing = await db
    .select({ id: followsTable.id })
    .from(followsTable)
    .where(
      and(
        eq(followsTable.userId, userId),
        eq(followsTable.leetcodeUsername, leetcodeUsername),
      ),
    );

  if (existing.length > 0) {
    res.status(400).json({ error: "You are already following this user" });
    return;
  }

  // Check shared profile cache first; only call LeetCode if not cached
  const [cached] = await db
    .select()
    .from(leetcodeProfilesTable)
    .where(eq(leetcodeProfilesTable.username, leetcodeUsername))
    .limit(1);

  let profile = cached
    ? {
        realName: cached.displayName ?? undefined,
        userAvatar: cached.avatarUrl ?? undefined,
        totalSolved: cached.totalSolved ?? undefined,
      }
    : null;

  if (!profile) {
    // Not cached yet — fetch live and persist to shared cache
    const live = await getLeetCodeProfile(leetcodeUsername);
    if (!live) {
      res.status(400).json({ error: "LeetCode username not found or profile is private" });
      return;
    }

    await db
      .insert(leetcodeProfilesTable)
      .values({
        username: leetcodeUsername,
        displayName: live.realName ?? null,
        avatarUrl: live.userAvatar ?? null,
        totalSolved: live.totalSolved ?? null,
        easySolved: live.easySolved ?? null,
        mediumSolved: live.mediumSolved ?? null,
        hardSolved: live.hardSolved ?? null,
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
          lastPolledAt: new Date(),
          updatedAt: new Date(),
        },
      });

    profile = {
      realName: live.realName ?? undefined,
      userAvatar: live.userAvatar ?? undefined,
      totalSolved: live.totalSolved ?? undefined,
    };
  }

  const [follow] = await db
    .insert(followsTable)
    .values({
      userId,
      leetcodeUsername,
      displayName: profile.realName ?? null,
      avatarUrl: profile.userAvatar ?? null,
      totalSolved: profile.totalSolved ?? null,
    })
    .returning();

  req.log.info({ userId, leetcodeUsername }, "New follow created");

  // Backfill historical solved problems in the background so the activity feed
  // and leaderboard are populated immediately — no await so the response is fast.
  backfillUserProblems(leetcodeUsername).catch((err) =>
    req.log.error({ err, leetcodeUsername }, "Background backfill failed"),
  );

  res.status(201).json(serializeDates(follow));
});

router.delete("/follows/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFollowParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.id, params.data.id),
        eq(followsTable.userId, userId),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Follow not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
