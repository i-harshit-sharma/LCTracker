import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * leetcode_profiles — shared cache for LeetCode profile data, keyed by username.
 *
 * One row per LeetCode username, regardless of how many platform users follow it.
 * followingJson stores a JSON-serialized array of FollowingEntry objects fetched
 * from LeetCode, so the profile page can show who this user follows without a
 * live LeetCode API call.
 */
export const leetcodeProfilesTable = pgTable("leetcode_profiles", {
  username: text("username").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  totalSolved: integer("total_solved"),
  easySolved: integer("easy_solved"),
  mediumSolved: integer("medium_solved"),
  hardSolved: integer("hard_solved"),
  /** JSON array of { username, displayName, avatarUrl } — who this user follows on LeetCode */
  followingJson: text("following_json"),
  /** Timestamp of the last successful profile+submissions poll */
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LeetcodeProfile = typeof leetcodeProfilesTable.$inferSelect;
