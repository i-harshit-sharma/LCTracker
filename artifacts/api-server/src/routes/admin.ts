import { Router, type IRouter } from "express";
import { exec, spawn } from "child_process";
import path from "path";

import {
  db,
  followsTable,
  leetcodeProfilesTable,
  eq,
  and,
  inArray,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getLeetCodeProfile } from "../lib/leetcode";
import { backfillUserProblems } from "../lib/poller";
import { serializeDates } from "../lib/serialize";
import { z } from "zod";
import posthog from "../lib/posthog";
import { logger } from "../lib/logger";

import fs from "fs";

const router: IRouter = Router();

const BulkFollowBody = z.object({
  usernames: z.array(z.string().min(1)),
});

/**
 * POST /api/admin/bulk-follow
 *
 * Password protected bulk follow.
 */
router.post(
  "/admin/bulk-follow",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as any).userId as string;
    const password = req.headers["x-admin-password"];

    if (password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Invalid admin password" });
      return;
    }

    const parsed = BulkFollowBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { usernames } = parsed.data;
    const results = {
      added: [] as string[],
      alreadyFollowing: [] as string[],
      notFound: [] as string[],
    };

    for (const username of usernames) {
      const leetcodeUsername = username.trim().toLowerCase();

      // 1. Check if already following
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
        results.alreadyFollowing.push(leetcodeUsername);
        continue;
      }

      // 2. Check profile cache
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
        const live = await getLeetCodeProfile(leetcodeUsername);
        if (!live) {
          results.notFound.push(leetcodeUsername);
          continue;
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

      // 3. Create follow
      await db.insert(followsTable).values({
        userId,
        leetcodeUsername,
        displayName: profile.realName ?? null,
        avatarUrl: profile.userAvatar ?? null,
        totalSolved: profile.totalSolved ?? null,
      });

      results.added.push(leetcodeUsername);

      // Background backfill
      backfillUserProblems(leetcodeUsername).catch(() => {});
    }

    res.json(results);

    posthog.capture({
      distinctId: userId,
      event: "Admin Bulk Follow Executed",
      properties: {
        addedCount: results.added.length,
        alreadyFollowingCount: results.alreadyFollowing.length,
        notFoundCount: results.notFound.length,
      },
    });
  },
);

/**
 * GET /api/admin/export-follows
 */
router.get(
  "/admin/export-follows",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as any).userId as string;
    const password = req.headers["x-admin-password"];

    if (password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Invalid admin password" });
      return;
    }

    const follows = await db
      .select({ leetcodeUsername: followsTable.leetcodeUsername })
      .from(followsTable)
      .where(eq(followsTable.userId, userId));

    const usernames = follows.map((f) => f.leetcodeUsername);
    res.json(usernames);

    posthog.capture({
      distinctId: userId,
      event: "Admin Export Follows Executed",
      properties: {
        count: usernames.length,
      },
    });
  },
);

/**
 * POST /api/admin/deploy
 *
 * Trigger a full deployment by running start.sh.
 * Authenticated via x-deploy-secret header.
 */
router.post("/admin/deploy", async (req, res): Promise<void> => {
  const secret = req.headers["x-deploy-secret"];
  const deploySecret = process.env.DEPLOY_SECRET;

  if (!deploySecret) {
    res.status(500).json({ error: "DEPLOY_SECRET not configured on server" });
    return;
  }

  if (secret !== deploySecret) {
    res.status(401).json({ error: "Invalid deploy secret" });
    return;
  }

  // Resolve the root directory by looking for start.sh
  let rootDir = __dirname;
  // We go up at most 5 levels to find start.sh (root)
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(rootDir, "start.sh"))) {
      break;
    }
    rootDir = path.dirname(rootDir);
  }

  const scriptPath = path.resolve(rootDir, "start.sh");

  if (!fs.existsSync(scriptPath)) {
    logger.error(
      { rootDir, __dirname },
      "Could not find start.sh for deployment",
    );
    res
      .status(500)
      .json({ error: "Deployment script (start.sh) not found in root" });
    return;
  }

  logger.info(
    { scriptPath, rootDir },
    "Triggering automated deployment from root",
  );

  // Set headers for streaming text
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Spawn bash with rootDir as the working directory
  const child = spawn("bash", [scriptPath], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: "production" },
  });

  child.stdout.on("data", (data) => {
    if (!res.writableEnded) {
      res.write(data);
    }
  });

  child.stderr.on("data", (data) => {
    if (!res.writableEnded) {
      res.write(data);
    }
  });

  child.on("error", (err) => {
    logger.error({ err: err.message }, "Deployment process error");
    if (!res.writableEnded) {
      res.write(`\n❌ Process Error: ${err.message}\n`);
      res.end();
    }
  });

  child.on("close", (code) => {
    logger.info({ code }, "Deployment script closed");
    if (!res.writableEnded) {
      if (code === 0) {
        res.write(`\n✅ Deployment successful!\n`);
      } else {
        res.write(`\n❌ Deployment failed with code ${code}\n`);
      }
      res.end();
    }
  });

  posthog.capture({
    distinctId: "api-server",
    event: "Admin Deployment Triggered (Streaming)",
  });
});

export default router;
