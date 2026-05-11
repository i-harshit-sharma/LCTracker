import { PostHog } from "posthog-node";

const posthogClient = new PostHog(
  process.env.POSTHOG_KEY || "phc_tj6y7sMrcXAfds3oPHUzaZr9ttFfnxHB4YeEkjchShg4",
  {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 1000,
  },
);

// Graceful shutdown
process.on("SIGTERM", async () => {
  await posthogClient.shutdown();
});

process.on("SIGINT", async () => {
  await posthogClient.shutdown();
});

export default posthogClient;
