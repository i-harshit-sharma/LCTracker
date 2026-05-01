import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * push_subscriptions — stores browser Web Push subscription objects per user.
 * A single user can have multiple subscriptions (one per browser/device).
 * Keyed on endpoint, which is globally unique per push service.
 */
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    /** Clerk user ID of the subscriber */
    userId: text("user_id").notNull(),
    /** The push service endpoint URL (globally unique per subscription) */
    endpoint: text("endpoint").notNull(),
    /** ECDH public key from the PushSubscription (base64url) */
    p256dh: text("p256dh").notNull(),
    /** Auth secret from the PushSubscription (base64url) */
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointIdx: uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint),
  }),
);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
