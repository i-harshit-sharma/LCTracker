import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

/**
 * requireAuth middleware — validates that the incoming request has a valid Clerk session.
 * Attaches the Clerk user ID to req.userId for downstream handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  // Support both session-based and JWT claim-based user IDs
  const userId = auth?.sessionClaims?.userId as string | undefined || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
