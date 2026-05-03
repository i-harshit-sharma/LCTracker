/**
 * pushNotification.ts — Web Push delivery helper
 *
 * Wraps the `web-push` library to send a JSON payload to a single browser
 * push subscription. On 410 (Gone) responses the subscription is automatically
 * removed from the DB so stale rows don't accumulate.
 */

import webPush from "web-push";
import { db, pushSubscriptionsTable, eq } from "@workspace/db";

import { logger } from "./logger";

// ── VAPID setup ───────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL ?? "push@example.com";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in env");
}

webPush.setVapidDetails(
  `mailto:${DIGEST_FROM_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  /** Relative URL to open when the user clicks the notification */
  url?: string;
  icon?: string;
}

// ── Core helper ───────────────────────────────────────────────────────────────

/**
 * Sends a Web Push notification to a single subscription endpoint.
 * Silently removes the subscription row on 410 (subscription expired/revoked).
 * All errors are caught and logged — this function never throws.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<void> {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24-hour TTL
    );

    logger.debug({ endpoint: subscription.endpoint }, "Push notification sent");
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.response?.statusCode;

    if (statusCode === 410 || statusCode === 404) {
      // Subscription has been revoked or expired — remove from DB
      logger.info(
        { endpoint: subscription.endpoint, statusCode },
        "Push subscription expired, removing from DB",
      );
      await db
        .delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.endpoint, subscription.endpoint))
        .catch((dbErr) =>
          logger.error({ dbErr }, "Failed to delete expired push subscription"),
        );
    } else {
      logger.error(
        { err, endpoint: subscription.endpoint },
        "Failed to send push notification",
      );
    }
  }
}

/**
 * Sends a push notification to ALL subscriptions belonging to the given
 * Clerk userId. Used by the poller after detecting new solved problems.
 */
export async function sendPushNotificationsForUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  if (!subs.length) return;

  await Promise.all(subs.map((sub) => sendPushNotification(sub, payload)));
}
