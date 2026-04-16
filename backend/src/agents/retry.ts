import { z } from "zod";
import { openrouter, AI_MODEL } from "./openrouter.js";

interface AiCallOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
}

interface AiJsonCallOptions<T extends z.ZodType> extends AiCallOptions {
  schema: T;
  maxRetries?: number;
}

/**
 * Call OpenRouter and return raw text response.
 * Retries on transient errors (rate limits, network).
 */
export async function callAi(
  options: AiCallOptions,
  maxRetries: number = 2
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openrouter.messages.create({
        model: AI_MODEL,
        max_tokens: options.maxTokens ?? 2048,
        system: options.system,
        messages: [{ role: "user", content: options.userMessage }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
        throw new Error("Empty response from AI model");
      }

      return textBlock.text.trim();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode;

      // Don't retry on auth errors or invalid requests
      if (status === 401 || status === 403 || status === 400) {
        throw new Error(`AI call failed (${status}): ${err.message}`);
      }

      // Retry on rate limits and server errors
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`AI call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Call OpenRouter expecting JSON response. Validates with Zod schema.
 * Retries on parse failures with a "fix your JSON" follow-up.
 */
export async function callAiJson<T extends z.ZodType>(
  options: AiJsonCallOptions<T>
): Promise<z.infer<T>> {
  const maxRetries = options.maxRetries ?? 2;
  let lastError: string = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await callAi({
        system: options.system,
        userMessage:
          attempt === 0
            ? options.userMessage
            : `${options.userMessage}\n\nIMPORTANT: Your previous response had an error: ${lastError}\nPlease respond with ONLY valid JSON matching the required format. No markdown, no explanation.`,
        maxTokens: options.maxTokens,
      });

      // Strip markdown code fences
      let jsonText = raw;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      // Try to extract JSON if there's text around it
      if (!jsonText.startsWith("{") && !jsonText.startsWith("[")) {
        const jsonMatch = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        }
      }

      const parsed = JSON.parse(jsonText);
      return options.schema.parse(parsed);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        lastError = `JSON schema validation failed: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`;
      } else if (err instanceof SyntaxError) {
        lastError = `Invalid JSON: ${err.message}`;
      } else {
        // Non-parse error (network, auth) — don't retry as JSON fix
        throw err;
      }

      if (attempt === maxRetries) {
        throw new Error(`AI JSON call failed after ${maxRetries + 1} attempts. Last error: ${lastError}`);
      }
    }
  }

  throw new Error("Unreachable");
}
