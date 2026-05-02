import { Router } from "express";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router = Router();
const LOG_FILE = path.join(process.cwd(), "logs", "server.json");

router.get("/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  logger.info({ ip: req.ip }, "Log stream client connected");

  let currentSize = 0;
  if (fs.existsSync(LOG_FILE)) {
    currentSize = fs.statSync(LOG_FILE).size;
    // Send the last few lines initially (e.g., last 50 lines)
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n");
    const lastLines = lines.slice(-50);
    lastLines.forEach((line) => {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    });
  }

  const sendNewLogs = () => {
    try {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > currentSize) {
        const stream = fs.createReadStream(LOG_FILE, {
          start: currentSize,
          end: stats.size,
        });
        
        let buffer = "";
        stream.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach((line) => {
            if (line.trim()) {
              res.write(`data: ${line}\n\n`);
            }
          });
        });

        stream.on("end", () => {
          currentSize = stats.size;
        });
      } else if (stats.size < currentSize) {
        // File was likely rotated or cleared
        currentSize = 0;
      }
    } catch (err) {
      logger.error({ err }, "Error reading log file for SSE");
    }
  };

  const watcher = fs.watch(path.dirname(LOG_FILE), (event, filename) => {
    if (filename === path.basename(LOG_FILE)) {
      sendNewLogs();
    }
  });

  // Keep-alive heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    watcher.close();
    logger.info({ ip: req.ip }, "Log stream client disconnected");
  });
});

export default router;
