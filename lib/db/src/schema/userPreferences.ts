import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * user_preferences — per-user digest email settings.
 * Keyed by Clerk userId. Created on first GET /api/preferences with defaults.
 */
export const userPreferencesTable = pgTable("user_preferences", {
  /** Clerk user ID — primary key (one row per user) */
  userId: text("user_id").primaryKey(),

  /**
   * UTC hour (0-23) at which the daily digest should be sent.
   * Defaults to 20 (8 PM UTC).
   */
  digestHour: integer("digest_hour").notNull().default(20),

  /**
   * UTC minute (0-59) at which the daily digest should be sent.
   * Defaults to 0, UI exposes 5-minute steps.
   */
  digestMinute: integer("digest_minute").notNull().default(0),

  /** Whether digest emails are enabled for this user. */
  emailEnabled: boolean("email_enabled").notNull().default(true),

  /** The user's own LeetCode username for personal stats. */
  leetcodeUsername: text("leetcode_username"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferencesTable).omit({
  updatedAt: true,
});
export const selectUserPreferencesSchema = createSelectSchema(userPreferencesTable);

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
