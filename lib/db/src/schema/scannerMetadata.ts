import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Global metadata for the background scanner.
 * Used to store the last processed submission ID so we can resume
 * across server restarts.
 */
export const scannerMetadataTable = pgTable("scanner_metadata", {
  key: text("key").primaryKey(), // e.g., 'last_scanned_id'
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
