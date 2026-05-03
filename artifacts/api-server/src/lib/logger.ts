import pino from "pino";
import posthog from "./posthog";

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
    hooks: {
      logMethod(inputArgs, method) {
        if (method.name === "error" || (this as any).level === 50) {
          const msg = inputArgs.find((arg) => typeof arg === "string");
          const obj = inputArgs.find((arg) => typeof arg === "object");
          posthog.capture({
            distinctId: "api-server",
            event: "Server Error Logged",
            properties: {
              message: msg,
              ...(obj || {}),
            },
          });
        }
        return method.apply(this, inputArgs as any);
      },
    },
  },
  transport,
);
