/**
 * Anthropic client — used ONLY for Claude Managed Agents (Strategist)
 *
 * This is the direct Anthropic API, not OpenRouter.
 * Used for: Strategist weekly/quarterly runs via Managed Agents sessions.
 *
 * NOT used for operational AI calls — those go through OpenRouter.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config.js";

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});
