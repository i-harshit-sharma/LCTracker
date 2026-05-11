/**
 * cron.ts — Scheduled jobs
 *
 * Two recurring tasks:
 *
 *   1. Per-user digest — fires every minute.
 *      Looks up which users have (digestHour, digestMinute) matching the current
 *      IST (UTC+5:30) time, since the frontend lets users pick their digest time
 *      in local Indian time.
 *      This gives minute-level granularity for each user's chosen send time.
 *
 *   2. Polling heartbeat — fires every 5 minutes as a safety net.
 *      The poller.ts module also manages its own setTimeout loop, but this
 *      cron expression provides a reliable fallback in case the setTimeout
 *      chain ever breaks (e.g. unhandled promise rejection).
 *
 * node-cron expression format: second(optional) minute hour dayOfMonth month dayOfWeek
 */

import cron from "node-cron";
import { db, userPreferencesTable, and, eq } from "@workspace/db";

import { sendDailyDigests } from "./emailDigest";
import { runPollCycle } from "./poller";
import { logger } from "./logger";
import posthog from "./posthog";

/** Register all cron jobs. Call once at server startup. */
export function startCronJobs(): void {
  // ─── Per-user digest: runs every minute, matches hour+minute ─────────────
  cron.schedule(
    "* * * * *",
    async () => {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      logger.debug(
        { currentHour, currentMinute },
        "Cron: matching digest at UTC time",
      );
      // Find all users whose digest time matches right now (UTC)
      const targets = await db
        .select({ userId: userPreferencesTable.userId })
        .from(userPreferencesTable)
        .where(
          and(
            eq(userPreferencesTable.digestHour, currentHour),
            eq(userPreferencesTable.digestMinute, currentMinute),
            eq(userPreferencesTable.emailEnabled, true),
          ),
        );

      if (!targets.length) return; // No one has their digest scheduled right now

      logger.info(
        {
          count: targets.length,
          hour: currentHour,
          minute: currentMinute,
        },
        "Cron: dispatching digest emails (UTC)",
      );

      posthog.capture({
        distinctId: "api-server",
        event: "Daily Digest Dispatched",
        properties: {
          count: targets.length,
          hour: currentHour,
          minute: currentMinute,
        },
      });

      try {
        await sendDailyDigests(targets.map((t) => t.userId));
      } catch (err) {
        logger.error({ err }, "Cron: daily digest failed");
      }
    },
    { timezone: "UTC" },
  );

  // ─── Poll fallback every 5 minutes ────────────────────────────────────────
  cron.schedule("*/5 * * * *", async () => {
    logger.debug("Cron: poll heartbeat");
    try {
      posthog.capture({
        distinctId: "api-server",
        event: "Poll Heartbeat Executed",
      });
      await runPollCycle();
    } catch (err) {
      logger.error({ err }, "Cron: poll cycle failed");
    }
  });

  logger.info(
    "Cron jobs registered (digest per-minute with user schedules, poll every 5 min)",
  );
}
