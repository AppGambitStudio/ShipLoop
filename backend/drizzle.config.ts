import { defineConfig } from "drizzle-kit";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
