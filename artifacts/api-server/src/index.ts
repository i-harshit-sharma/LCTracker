import app from "./app";
import { logger } from "./lib/logger";
import { startPoller } from "./lib/poller";
import { startCronJobs } from "./lib/cron";
import posthog from "./lib/posthog";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Track server start
  posthog.capture({
    distinctId: "api-server",
    event: "Server Started",
    properties: {
      port,
      node_env: process.env.NODE_ENV || "development",
    },
  });

  // Start the background LeetCode polling loop
  startPoller();

  // Register cron jobs (daily digest + poll fallback)
  startCronJobs();
});
