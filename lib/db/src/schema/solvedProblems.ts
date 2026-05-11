import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * solved_problems — stores each accepted LeetCode submission we've detected.
 * The unique index on (leetcodeUsername, problemSlug) prevents duplicate records
 * when the poller re-checks the same submission across multiple polling cycles.
 */
export const solvedProblemsTable = pgTable(
  "solved_problems",
  {
    id: serial("id").primaryKey(),
    /** LeetCode username who solved the problem */
    leetcodeUsername: text("leetcode_username").notNull(),
    /** URL slug for the problem (e.g. "two-sum") */
    problemSlug: text("problem_slug").notNull(),
    /** Human-readable problem title */
    problemTitle: text("problem_title").notNull(),
    /** Easy | Medium | Hard */
    difficulty: text("difficulty").notNull().default("Unknown"),
    /** When LeetCode says it was solved (from submission timestamp) */
    solvedAt: timestamp("solved_at", { withTimezone: true }).notNull(),
    /** LeetCode submission ID */
    submissionId: text("submission_id"),
    /** When our system recorded it */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("solved_problems_username_slug_idx").on(
      table.leetcodeUsername,
      table.problemSlug,
    ),
  ],
);

export const insertSolvedProblemSchema = createInsertSchema(
  solvedProblemsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertSolvedProblem = z.infer<typeof insertSolvedProblemSchema>;
export type SolvedProblem = typeof solvedProblemsTable.$inferSelect;
