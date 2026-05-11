/**
 * preferences.ts — REST routes for digest email settings
 *
 * GET /api/preferences   — return current user's digest preferences (creates default row if absent)
 * PUT /api/preferences   — update digest hour, minute, and/or email enabled flag
 */

import { Router, type IRouter } from "express";
import { db, userPreferencesTable, eq } from "@workspace/db";
import {
  GetPreferencesResponse,
  UpdatePreferencesBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import posthog from "../lib/posthog";
import { getLeetCodeProfile } from "../lib/leetcode";
import crypto from "crypto";

const router: IRouter = Router();

function generateVerificationToken(): string {
  return "lc_verify_" + crypto.randomBytes(8).toString("hex");
}

router.get("/preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  // Upsert: insert defaults if absent, return existing row untouched if present
  const [prefs] = await db
    .insert(userPreferencesTable)
    .values({
      userId,
      digestHour: 20,
      digestMinute: 0,
      emailEnabled: true,
      onboardingCompleted: false,
    })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      // Set to itself — effectively a no-op that lets returning() work
      set: {
        digestHour: userPreferencesTable.digestHour,
        digestMinute: userPreferencesTable.digestMinute,
        emailEnabled: userPreferencesTable.emailEnabled,
        onboardingCompleted: userPreferencesTable.onboardingCompleted,
      },
    })
    .returning();

  if (!prefs) {
    res.status(500).json({ error: "Could not load preferences" });
    return;
  }

  // Generate token if user has a username but is not verified and lacks a token
  if (prefs.leetcodeUsername && !prefs.isVerified && !prefs.verificationToken) {
    const token = generateVerificationToken();
    const [updated] = await db
      .update(userPreferencesTable)
      .set({ verificationToken: token, updatedAt: new Date() })
      .where(eq(userPreferencesTable.userId, userId))
      .returning();
    res.json(GetPreferencesResponse.parse(serializeDates(updated)));
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

  const {
    digestHour,
    digestMinute,
    emailEnabled,
    leetcodeUsername,
    onboardingCompleted,
  } = parsed.data;

  const patch: any = { updatedAt: new Date() };
  if (digestHour !== undefined) patch.digestHour = digestHour;
  if (digestMinute !== undefined) patch.digestMinute = digestMinute;
  if (emailEnabled !== undefined) patch.emailEnabled = emailEnabled;
  if (onboardingCompleted !== undefined)
    patch.onboardingCompleted = onboardingCompleted;
  if (leetcodeUsername !== undefined) {
    const newUsername = leetcodeUsername
      ? leetcodeUsername.trim().toLowerCase()
      : null;

    const [current] = await db
      .select({ leetcodeUsername: userPreferencesTable.leetcodeUsername })
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .limit(1);

    // If username is changing OR being set for the first time
    if (!current || current.leetcodeUsername !== newUsername) {
      patch.leetcodeUsername = newUsername;
      patch.isVerified = false;
      patch.verificationToken = newUsername
        ? generateVerificationToken()
        : null;
    }
  }

  const [updated] = await db
    .insert(userPreferencesTable)
    .values({
      userId,
      digestHour: digestHour ?? 20,
      digestMinute: digestMinute ?? 0,
      emailEnabled: emailEnabled ?? true,
      onboardingCompleted: onboardingCompleted ?? false,
      leetcodeUsername: leetcodeUsername
        ? leetcodeUsername.trim().toLowerCase()
        : null,
      isVerified: false,
      verificationToken: leetcodeUsername ? generateVerificationToken() : null,
    })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: patch as any,
    })
    .returning();

  res.json(GetPreferencesResponse.parse(serializeDates(updated)));

  posthog.capture({
    distinctId: userId,
    event: "Preferences Updated",
    properties: {
      emailEnabled: updated.emailEnabled,
      digestHour: updated.digestHour,
      digestMinute: updated.digestMinute,
      leetcodeUsername: updated.leetcodeUsername,
      onboardingCompleted: updated.onboardingCompleted,
    },
  });
});

router.post(
  "/preferences/verify",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as any).userId as string;

    const [prefs] = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .limit(1);

    if (!prefs || !prefs.leetcodeUsername || !prefs.verificationToken) {
      res
        .status(400)
        .json({ error: "No username or verification token found" });
      return;
    }

    if (prefs.isVerified) {
      res.json(GetPreferencesResponse.parse(serializeDates(prefs)));
      return;
    }

    const profile = await getLeetCodeProfile(prefs.leetcodeUsername);

    if (!profile) {
      res.status(400).json({ error: "LeetCode profile not found" });
      return;
    }

    if (profile.isPrivate) {
      res.status(400).json({
        error:
          "Your LeetCode profile is private. Please make it public to verify.",
      });
      return;
    }

    const bio = profile.aboutMe || "";
    if (!bio.includes(prefs.verificationToken)) {
      res.status(400).json({
        error:
          "Verification token not found in your LeetCode 'About' section. " +
          "Please ensure you've added the string exactly as shown.",
      });
      return;
    }

    const [updated] = await db
      .update(userPreferencesTable)
      .set({
        isVerified: true,
        verificationToken: null, // Clear token after successful verification
        updatedAt: new Date(),
      })
      .where(eq(userPreferencesTable.userId, userId))
      .returning();

    res.json(GetPreferencesResponse.parse(serializeDates(updated)));

    posthog.capture({
      distinctId: userId,
      event: "User Verified",
      properties: {
        leetcodeUsername: updated.leetcodeUsername,
      },
    });
  },
);

export default router;
