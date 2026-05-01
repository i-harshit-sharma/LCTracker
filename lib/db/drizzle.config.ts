import { defineConfig } from "drizzle-kit";
import path from "path";
import * as dotenv from "dotenv";

// Load from root or artifacts/api-server if present
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../../artifacts/api-server/.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Make sure it is defined in your .env file.");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
