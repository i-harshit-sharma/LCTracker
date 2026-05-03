import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../artifacts/api-server/.env") });

// Use dynamic imports to ensure dotenv.config() executes before lib/db/src/index.ts is loaded
const { db, leetcodeProfilesTable, solvedProblemsTable, eq } = await import("@workspace/db");
const { backfillUserProblems } = await import("../../artifacts/api-server/src/lib/poller");
const { logger } = await import("../../artifacts/api-server/src/lib/logger");

/**
 * Manual Recalculation Script
 * 
 * This script iterates through all users in the leetcode_profiles table,
 * deletes their existing solved_problems records (to clear any bad data),
 * and re-runs the backfill process to fetch fresh data with correct timestamps.
 */
async function main() {
  logger.info("Starting manual recalculation of all profile data");

  // 1. Get all unique usernames currently in our database
  const profiles = await db
    .select({ username: leetcodeProfilesTable.username })
    .from(leetcodeProfilesTable);
    
  const usernames = profiles.map((p) => p.username);
  logger.info({ count: usernames.length }, "Found users to recalculate");

  for (const username of usernames) {
    try {
      logger.info({ username }, "Recalculating profile...");

      // 2. Delete existing solved problems for this user
      // We do this because the backfill logic uses onConflictDoNothing.
      // To "overwrite" with the new (corrected) timestamps, we must first remove the old ones.
      await db
        .delete(solvedProblemsTable)
        .where(eq(solvedProblemsTable.leetcodeUsername, username));

      // 3. Re-trigger the backfill
      // This will call the LeetCode API, fetch all solved problems,
      // and re-insert them into the DB using our updated timestamp logic.
      await backfillUserProblems(username);

      logger.info({ username }, "Recalculation complete");
    } catch (err) {
      logger.error({ err, username }, "Failed to recalculate profile");
    }
  }

  logger.info("Manual recalculation finished successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
