/**
 * emailDigest.ts — Daily digest email system
 *
 * Sends each registered user a summary of everything the people they follow
 * solved today. The digest is triggered by the cron job once per minute; it
 * fires for users whose (digestHour, digestMinute) matches the current UTC time.
 *
 * Email delivery uses Resend (https://resend.com). If RESEND_API_KEY is not
 * configured, the digest is logged but not sent — this allows the app to run
 * in development without requiring an email provider.
 *
 * The email is plain HTML; no external template engine is required.
 */

import { db, followsTable, solvedProblemsTable } from "@workspace/db";
import { eq, gte, lte, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Send the daily digest to the given list of Clerk userIds.
 * Only users who have at least one followed profile that solved a problem
 * today will actually receive an email.
 *
 * @param userIds  Subset of users whose digest hour+minute matches right now.
 *                 Pass an empty array to skip (no-op).
 */
export async function sendDailyDigests(userIds: string[]): Promise<void> {
  if (!userIds.length) return;

  logger.info({ count: userIds.length }, "Starting daily digest run");

  // Define "today" as midnight→midnight in UTC
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  );
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
  );

  // 1. Load follow relationships only for the target users
  const allFollows = await db
    .select({ userId: followsTable.userId, leetcodeUsername: followsTable.leetcodeUsername })
    .from(followsTable)
    .where(inArray(followsTable.userId, userIds));

  if (!allFollows.length) {
    logger.info("No follows found for digest recipients — skipping");
    return;
  }

  // 2. Get all unique usernames for these followers
  const allUsernames = [...new Set(allFollows.map((f) => f.leetcodeUsername))];

  // 3. Fetch every problem solved today for those usernames
  const todaysSolves = await db
    .select()
    .from(solvedProblemsTable)
    .where(
      and(
        inArray(solvedProblemsTable.leetcodeUsername, allUsernames),
        gte(solvedProblemsTable.solvedAt, startOfDay),
        lte(solvedProblemsTable.solvedAt, endOfDay),
      ),
    );

  if (!todaysSolves.length) {
    logger.info("No problems solved today — skipping digest emails");
    return;
  }

  // 4. Group solves by username for quick lookup
  const solvesByUser = new Map<string, typeof todaysSolves>();
  for (const solve of todaysSolves) {
    const list = solvesByUser.get(solve.leetcodeUsername) ?? [];
    list.push(solve);
    solvesByUser.set(solve.leetcodeUsername, list);
  }

  // 5. Group follows by userId (each user gets one email)
  const followsByUser = new Map<string, string[]>();
  for (const follow of allFollows) {
    const list = followsByUser.get(follow.userId) ?? [];
    list.push(follow.leetcodeUsername);
    followsByUser.set(follow.userId, list);
  }

  // 6. For each user, build and send their digest
  let sentCount = 0;
  for (const [userId, usernames] of followsByUser) {
    // Collect today's activity for only the usernames this user follows
    const activity = usernames.flatMap((u) => solvesByUser.get(u) ?? []);

    if (!activity.length) continue; // Nothing to report — skip this user

    const html = buildDigestHtml(userId, usernames, solvesByUser);
    await sendEmail({
      to: userId, // In production this would be the user's email address from Clerk
      subject: `Your LeetCode daily digest — ${activity.length} problem${activity.length === 1 ? "" : "s"} solved today`,
      html,
    });
    sentCount++;
  }

  logger.info({ sentCount }, "Daily digest run complete");
}

/** Build the HTML body for one user's digest email */
function buildDigestHtml(
  userId: string,
  followedUsernames: string[],
  solvesByUser: Map<string, { problemTitle: string; difficulty: string; problemSlug: string; solvedAt: Date }[]>,
): string {
  const rows = followedUsernames.flatMap((username) => {
    const solves = solvesByUser.get(username) ?? [];
    return solves.map((s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(username)}</strong>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <a href="https://leetcode.com/problems/${escapeHtml(s.problemSlug)}/" style="color:#f97316;text-decoration:none;">
            ${escapeHtml(s.problemTitle)}
          </a>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="color:${difficultyColor(s.difficulty)};">${escapeHtml(s.difficulty)}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">
          ${s.solvedAt.toUTCString()}
        </td>
      </tr>`);
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Daily LeetCode Digest</title></head>
<body style="font-family:Inter,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 4px;">
      🧑‍💻 Your Daily LeetCode Digest
    </h1>
    <p style="color:#6b7280;margin:0 0 24px;">
      Here's what the people you follow solved today:
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">User</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Problem</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Difficulty</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
      You're receiving this because you follow LeetCode users on LeetCode Tracker.
      To change when you receive this email, visit your <a href="#" style="color:#f97316;">notification settings</a>.
    </p>
  </div>
</body>
</html>`;
}

function difficultyColor(difficulty: string): string {
  if (difficulty === "Easy") return "#22c55e";
  if (difficulty === "Medium") return "#f97316";
  if (difficulty === "Hard") return "#ef4444";
  return "#6b7280";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Send an email via Resend. Falls back to logging if no API key is configured. */
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.DIGEST_FROM_EMAIL ?? "digest@yourdomain.com";

  if (!apiKey) {
    // Development mode — log instead of sending
    logger.info({ to, subject }, "RESEND_API_KEY not set — digest email logged only");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }

    logger.info({ to, subject }, "Digest email sent via Resend");
  } catch (err) {
    logger.error({ err, to }, "Failed to send digest email");
  }
}
