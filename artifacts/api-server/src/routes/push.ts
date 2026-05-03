/**
 * push.ts — REST routes for browser push notification subscriptions
 *
 * GET  /api/push/vapid-public-key   — returns server VAPID public key (no auth needed)
 * POST /api/push/subscribe          — save a PushSubscription for the current user
 * DELETE /api/push/subscribe        — remove a PushSubscription (user opts out)
 */

import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  GetVapidPublicKeyResponse,
  SavePushSubscriptionBody,
  DeletePushSubscriptionBody,
  SavePushSubscriptionResponse,
  DeletePushSubscriptionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── GET /api/push/vapid-public-key ────────────────────────────────────────────
// No auth required — the frontend needs this before it even asks for permission.

router.get("/push/vapid-public-key", (req, res): void => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    res.status(500).json({ error: "VAPID_PUBLIC_KEY not configured" });
    return;
  }
  res.json(GetVapidPublicKeyResponse.parse({ publicKey }));
});

// ── POST /api/push/subscribe ──────────────────────────────────────────────────

router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const parsed = SavePushSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { endpoint, p256dh, auth } = parsed.data;

  // Upsert — update userId/keys if the endpoint already exists
  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh, auth },
    });

  logger.info({ userId, endpoint }, "Push subscription saved");
  res.json(SavePushSubscriptionResponse.parse({ success: true }));
});

// ── DELETE /api/push/subscribe ────────────────────────────────────────────────

router.delete("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const parsed = DeletePushSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { endpoint } = parsed.data;

  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, endpoint),
        eq(pushSubscriptionsTable.userId, userId),
      ),
    );

  logger.info({ userId, endpoint }, "Push subscription removed");
  res.json(DeletePushSubscriptionResponse.parse({ success: true }));
});

// ── POST /api/push/mock ──────────────────────────────────────────────────────
// Sends a sample notification to the user's active subscriptions to verify setup.

import { sendPushNotificationsForUser } from "../lib/pushNotification";

router.post("/push/mock", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  await sendPushNotificationsForUser(userId, {
    title: "🔔 Push Notifications Enabled!",
    body: "You'll now get alerts when friends solve problems. Happy coding! 🚀",
    url: "https://leetcode.com/problemset/all/",
    icon: "/logo.svg",
  });

  res.json({ success: true });
});

export default router;
