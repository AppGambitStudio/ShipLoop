/**
 * OpenRouter client — used for all operational AI calls
 * (Noticing, Acting, Reviewing, scoring, edit diff analysis)
 *
 * NOT used for Claude Managed Agents (Strategist) — that uses the Anthropic client directly.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config.js";

export const openrouter = new Anthropic({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api",
  defaultHeaders: {
    "HTTP-Referer": env.FRONTEND_URL,
    "X-Title": "ShipLoop",
  },
});

export const AI_MODEL = env.OPENROUTER_MODEL;
