import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: { destination: "./logs/server.json", mkdir: true } as any,
    },
    {
      target: isProduction ? "pino/file" : "pino-pretty",
      options: (isProduction ? { destination: 1 } : { colorize: true }) as any,
    },
  ],
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
  },
  transport,
);
