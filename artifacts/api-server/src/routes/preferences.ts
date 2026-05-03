/**
 * preferences.ts — REST routes for digest email settings
 *
 * GET /api/preferences   — return current user's digest preferences (creates default row if absent)
 * PUT /api/preferences   — update digest hour, minute, and/or email enabled flag
 */

import { Router, type IRouter } from "express";
import { db, userPreferencesTable } from "@workspace/db";
import { GetPreferencesResponse, UpdatePreferencesBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  // Upsert: insert defaults if absent, return existing row untouched if present
  const [prefs] = await db
    .insert(userPreferencesTable)
    .values({ userId, digestHour: 20, digestMinute: 0, emailEnabled: true })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      // Set to itself — effectively a no-op that lets returning() work
      set: {
        digestHour:   userPreferencesTable.digestHour,
        digestMinute: userPreferencesTable.digestMinute,
        emailEnabled: userPreferencesTable.emailEnabled,
      },
    })
    .returning();

  if (!prefs) {
    res.status(500).json({ error: "Could not load preferences" });
    return;
  }

  res.json(GetPreferencesResponse.parse(serializeDates(prefs)));
});

router.put("/preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { digestHour, digestMinute, emailEnabled, leetcodeUsername } = parsed.data;

  // Build the patch — only update fields that were supplied
  const patch: Partial<typeof parsed.data & { updatedAt: Date }> = { updatedAt: new Date() };
  if (digestHour   !== undefined) patch.digestHour   = digestHour;
  if (digestMinute !== undefined) patch.digestMinute = digestMinute;
  if (emailEnabled !== undefined) patch.emailEnabled = emailEnabled;
  if (leetcodeUsername !== undefined) patch.leetcodeUsername = leetcodeUsername ? leetcodeUsername.toLowerCase() : null;

  const [updated] = await db
    .insert(userPreferencesTable)
    .values({
      userId,
      digestHour:   digestHour   ?? 20,
      digestMinute: digestMinute ?? 0,
      emailEnabled: emailEnabled ?? true,
    })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: patch as any,
    })
    .returning();

  res.json(GetPreferencesResponse.parse(serializeDates(updated)));
});

export default router;
