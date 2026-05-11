import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * follows — tracks which Clerk users follow which LeetCode usernames.
 * One row per (userId, leetcodeUsername) pair; unique constraint enforces no duplicates.
 */
export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  /** Clerk user ID of the person who is following */
  userId: text("user_id").notNull(),
  /** The LeetCode username being followed */
  leetcodeUsername: text("leetcode_username").notNull(),
  /** Cached display name from LeetCode profile */
  displayName: text("display_name"),
  /** Cached avatar URL from LeetCode profile */
  avatarUrl: text("avatar_url"),
  /** Cached total problems solved count */
  totalSolved: integer("total_solved"),
  /** Timestamp of the last time this profile was polled for new submissions */
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFollowSchema = createInsertSchema(followsTable).omit({
  id: true,
  createdAt: true,
  lastPolledAt: true,
});
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
