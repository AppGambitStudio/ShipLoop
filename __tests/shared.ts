import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

// OpenRouter client (Sonnet — for Noticing, Acting, Reviewing tests)
export const sonnet = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://shiploop.io",
    "X-Title": "ShipLoop Tests",
  },
});

// Anthropic direct client (Opus — for Strategist test)
export const opus = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SONNET_MODEL = "anthropic/claude-sonnet-4-20250514";
export const OPUS_MODEL = "claude-opus-4-20250514";

export function loadJson<T>(filePath: string): T {
  const fullPath = path.join(__dirname, filePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

export function saveJson(filePath: string, data: unknown): void {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
}

export function saveResults(testName: string, results: unknown): void {
  const dir = path.join(__dirname, "results");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${testName}-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${filePath}`);
}

export function printHeader(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

export function printDivider(): void {
  console.log("\n" + "-".repeat(60) + "\n");
}
