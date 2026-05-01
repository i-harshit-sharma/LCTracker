/**
 * cron.ts — Scheduled jobs
 *
 * Uses node-cron to run two recurring tasks:
 *
 *   1. Daily digest — fires at 23:59 every night (UTC).
 *      Aggregates all problems solved today by followed users and emails
 *      each registered user their personalized summary.
 *
 *   2. Polling heartbeat — fires every 5 minutes as a safety net.
 *      The poller.ts module also manages its own setTimeout loop, but this
 *      cron expression provides a reliable fallback in case the setTimeout
 *      chain ever breaks (e.g. unhandled promise rejection).
 *
 * node-cron expression format: second(optional) minute hour dayOfMonth month dayOfWeek
 */

import cron from "node-cron";
import { sendDailyDigests } from "./emailDigest";
import { runPollCycle } from "./poller";
import { logger } from "./logger";

/** Register all cron jobs. Call once at server startup. */
export function startCronJobs(): void {
  // ─── Daily digest at 23:59 UTC ────────────────────────────────────────────
  cron.schedule(
    "59 23 * * *",
    async () => {
      logger.info("Cron: daily digest starting");
      try {
        await sendDailyDigests();
      } catch (err) {
        logger.error({ err }, "Cron: daily digest failed");
      }
    },
    { timezone: "UTC" },
  );

  // ─── Poll fallback every 5 minutes ────────────────────────────────────────
  cron.schedule(
    "*/5 * * * *",
    async () => {
      logger.debug("Cron: poll heartbeat");
      try {
        await runPollCycle();
      } catch (err) {
        logger.error({ err }, "Cron: poll cycle failed");
      }
    },
  );

  logger.info("Cron jobs registered (daily digest at 23:59 UTC, poll every 5 min)");
}
