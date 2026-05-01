import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * notifications — in-app notifications sent to a Clerk user when someone they follow
 * solves a new LeetCode problem.
 */
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  /** Clerk user ID of the recipient */
  userId: text("user_id").notNull(),
  /** Human-readable notification message */
  message: text("message").notNull(),
  /** Notification type — "solve" for problem solved, "digest" for daily summary */
  type: text("type").notNull().default("solve"),
  /** LeetCode username that triggered the notification */
  leetcodeUsername: text("leetcode_username"),
  /** Title of the problem that was solved */
  problemTitle: text("problem_title"),
  /** URL slug of the problem */
  problemSlug: text("problem_slug"),
  /** Difficulty: Easy | Medium | Hard */
  difficulty: text("difficulty"),
  /** Whether the user has read this notification */
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** When the problem was actually solved on LeetCode */
  solvedAt: timestamp("solved_at", { withTimezone: true }),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
