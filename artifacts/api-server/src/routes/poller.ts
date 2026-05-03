import { Router } from "express";
import { getPollerStatus } from "../lib/poller";

const router = Router();

/**
 * Returns the current status of the background poller,
 * including when the next update is scheduled.
 */
router.get("/poller/status", (req, res) => {
  res.json(getPollerStatus());
});

export default router;
