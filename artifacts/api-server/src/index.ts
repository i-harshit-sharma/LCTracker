import app from "./app";
import { logger } from "./lib/logger";
import { startPoller } from "./lib/poller";
import { startCronJobs } from "./lib/cron";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start the background LeetCode polling loop
  startPoller();

  // Register cron jobs (daily digest + poll fallback)
  startCronJobs();
});
