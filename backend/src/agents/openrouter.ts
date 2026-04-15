import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config.js";

export const openrouter = new Anthropic({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "ShipLoop",
  },
});

export const SONNET_MODEL = "anthropic/claude-sonnet-4-20250514";
