import { z } from "zod";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from project root
import { config } from "dotenv";
config({ path: resolve(fileURLToPath(import.meta.url), "../../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-4-20250514"),
  ANTHROPIC_API_KEY: z.string().min(1),
  STRATEGIST_MODEL: z.string().default("claude-opus-4-6"),
  STORAGE_PATH: z.string().default("./storage"),
  BACKEND_PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
