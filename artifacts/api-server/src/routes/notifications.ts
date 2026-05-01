/**
 * notifications.ts — REST routes for in-app notifications
 *
 * GET /api/notifications              list notifications for the current user
 * PUT /api/notifications/read-all     mark all notifications as read
 * PUT /api/notifications/:id/read     mark a single notification as read
 */

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import {
  ListNotificationsResponse,
  ListNotificationsQueryParams,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const qp = ListNotificationsQueryParams.safeParse(req.query);
  const unreadOnly = qp.success ? qp.data.unreadOnly : false;

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(
      unreadOnly
        ? and(
            eq(notificationsTable.userId, userId),
            eq(notificationsTable.read, false),
          )
        : eq(notificationsTable.userId, userId),
    )
    .orderBy(desc(notificationsTable.createdAt));

  res.json(ListNotificationsResponse.parse(serializeDates(rows)));
});

router.put("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.read, false),
      ),
    );

  res.json({ success: true });
});

router.put("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = MarkNotificationReadParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.id, params.data.id),
        eq(notificationsTable.userId, userId), // only the owner can mark it read
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(MarkNotificationReadResponse.parse(serializeDates(updated)));
});

export default router;
