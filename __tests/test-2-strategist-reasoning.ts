/**
 * TEST 2: Strategist Reasoning — Multi-Step Agent with Tools
 *
 * Tests the ACTUAL pattern: Strategist as a Claude agent with custom tools
 * that reads data, reasons, and writes structured output through multiple steps.
 *
 * Simulates Managed Agents by giving Claude tools and letting it decide
 * which to call, in what order, and how to reason across tool results.
 *
 * Validates:
 * - Does the agent call the right tools in a reasonable order?
 * - Does it reason ACROSS data sources (not just summarise each)?
 * - Are directives specific, actionable, and data-referencing?
 * - Does it detect drift and produce non-obvious insights?
 *
 * Pass threshold: 3+ specific, non-obvious, data-referencing directives
 * Secondary: Agent calls tools in a logical order and cross-references data
 *
 * Uses pre-filled simulated data. Run as-is.
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { loadJson, saveResults, printHeader, printDivider } from "./shared";

// Use Anthropic direct for Opus (Strategist model)
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const OPUS_MODEL = "claude-opus-4-20250514";

interface SimData {
  user_config: Record<string, unknown>;
  assets: Array<Record<string, unknown>>;
  posted_content_last_30_days: Array<Record<string, unknown>>;
  approval_patterns_last_30_days: Record<string, unknown>;
  previous_monologues: Array<{ week_of: string; monologue: string }>;
}

// Define the custom tools the Strategist agent would have in production
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "read_asset_registry",
    description: "Returns all registered assets with their distribution status, priority score, last distribution date, and category. Use this first in every Strategist run.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_posted_content",
    description: "Returns posted content from the last N days with full engagement metrics. Always call with days=30 on weekly runs. days=90 on quarterly runs.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "number", description: "Number of days to look back" } },
      required: ["days"],
    },
  },
  {
    name: "read_internal_monologue",
    description: "Returns your previous internal monologue entries. Always read the last 2 entries for continuity.",
    input_schema: {
      type: "object" as const,
      properties: { count: { type: "number", description: "Number of recent entries to return" } },
      required: ["count"],
    },
  },
  {
    name: "read_user_config",
    description: "Returns the user's goal statement, channel registry, company type, and signal definitions.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_approval_patterns",
    description: "Returns approval/skip/edit patterns from the last 30 days. Shows what the human approved, skipped (with reasons), and commonly edited.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "write_directives",
    description: "Saves your strategic directives. This is the primary output that governs how Noticing and Acting agents behave this week. Call once at the end of your reasoning.",
    input_schema: {
      type: "object" as const,
      properties: {
        directives: {
          type: "object",
          properties: {
            channelWeights: { type: "object" },
            contentAngleDefaults: { type: "array" },
            priorityAssetIds: { type: "array" },
            silenceAlarm: { type: "boolean" },
            urgencyOverrides: { type: "object" },
          },
        },
        narrativeAssessment: { type: "string" },
        driftScore: { type: "number" },
        internalMonologue: { type: "string" },
      },
      required: ["directives", "narrativeAssessment", "driftScore", "internalMonologue"],
    },
  },
];

// Simulate tool responses from the database
function handleToolCall(name: string, input: Record<string, unknown>, data: SimData): string {
  switch (name) {
    case "read_asset_registry":
      return JSON.stringify(data.assets);
    case "read_posted_content":
      return JSON.stringify(data.posted_content_last_30_days);
    case "read_internal_monologue": {
      const count = (input.count as number) || 2;
      return JSON.stringify(data.previous_monologues.slice(-count));
    }
    case "read_user_config":
      return JSON.stringify(data.user_config);
    case "read_approval_patterns":
      return JSON.stringify(data.approval_patterns_last_30_days);
    case "write_directives":
      return JSON.stringify({ status: "saved", timestamp: "2026-03-31T08:00:00Z" });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function runTest() {
  printHeader("TEST 2: Strategist Reasoning (Multi-Step Agent with Tools)");

  const data = loadJson<SimData>("data/strategist-simulated.json");

  const systemPrompt = `You are the Strategist for ShipLoop — a distribution engine for builders.

Your role is NOT to draft content. Your role is to think, assess, and direct.

You have access to tools that let you read data from the system. Use them to understand the current state, then reason about what should change.

PROCESS:
1. Start by reading your last 2 internal monologue entries (continuity)
2. Read the asset registry and user config
3. Read posted content from the last 30 days with engagement metrics
4. Read approval patterns
5. Reason across ALL data sources — look for patterns, contradictions, and gaps
6. Write your directives using the write_directives tool

Your directives must be SPECIFIC and reference actual data. "Post more consistently" is not a directive. "Shift LinkedIn weight to 0.7 because proof-of-execution posts drove 4 CTO connections while insight posts drove 0" IS a directive.

Today is 2026-03-31. This is your Week 3 run.`;

  console.log("Starting Strategist agent loop with tools...\n");

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: "Run your weekly analysis. Read the data, reason about it, and issue directives." },
  ];

  const toolCallLog: Array<{ tool: string; input: Record<string, unknown>; step: number }> = [];
  let writeDirectivesOutput: Record<string, unknown> | null = null;
  let step = 0;
  const maxSteps = 10;

  // Agent loop — let the model call tools until it's done
  while (step < maxSteps) {
    step++;
    console.log(`  Step ${step}: Calling Opus...`);

    const response = await client.messages.create({
      model: OPUS_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      tools,
      messages,
    });

    // Process response
    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    // Check for text output (reasoning)
    for (const block of assistantContent) {
      if (block.type === "text" && block.text.trim()) {
        console.log(`  Step ${step} reasoning: ${block.text.slice(0, 120)}...`);
      }
    }

    // Check for tool calls
    const toolUses = assistantContent.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0) {
      console.log(`  Step ${step}: No more tool calls. Agent done.`);
      break;
    }

    // Process each tool call
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const input = toolUse.input as Record<string, unknown>;
      console.log(`  Step ${step}: Tool call → ${toolUse.name}(${JSON.stringify(input).slice(0, 60)})`);
      toolCallLog.push({ tool: toolUse.name, input, step });

      if (toolUse.name === "write_directives") {
        writeDirectivesOutput = input;
      }

      const result = handleToolCall(toolUse.name, input, data);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
    }

    messages.push({ role: "user", content: toolResults });

    if (response.stop_reason === "end_turn") {
      console.log(`  Step ${step}: Agent finished (end_turn).`);
      break;
    }
  }

  // Extract final text output (the reasoning)
  const finalTextBlocks = messages
    .filter((m): m is { role: "assistant"; content: Anthropic.Messages.ContentBlock[] } => m.role === "assistant")
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text);

  printDivider();
  printHeader("AGENT EXECUTION SUMMARY");
  console.log(`Total steps: ${step}`);
  console.log(`Tool calls: ${toolCallLog.length}`);
  console.log(`Tool call order:`);
  for (const tc of toolCallLog) {
    console.log(`  ${tc.step}. ${tc.tool}(${JSON.stringify(tc.input).slice(0, 50)})`);
  }

  printDivider();
  printHeader("STRATEGIST REASONING");
  console.log(finalTextBlocks.join("\n\n"));

  if (writeDirectivesOutput) {
    printDivider();
    printHeader("DIRECTIVES OUTPUT");
    console.log(JSON.stringify(writeDirectivesOutput, null, 2));
  } else {
    printDivider();
    console.log("WARNING: Agent did NOT call write_directives. No directives produced.");
  }

  printDivider();
  printHeader("SCORING TIME — Your Turn");
  console.log("1. TOOL USAGE: Did it read data in a logical order?");
  console.log("   Expected: monologue first (continuity) → config → assets → posts → approvals → write");
  console.log(`   Actual: ${toolCallLog.map((t) => t.tool).join(" → ")}\n`);
  console.log("2. CROSS-REFERENCING: Did it connect insights across data sources?");
  console.log("   e.g., linking insight post engagement (posts) to 0 CTO connections (signals)");
  console.log("   to skip reasons (approvals) to original goal (config)\n");
  console.log("3. SPECIFICITY: Count directives that reference actual data points\n");
  console.log("4. DRIFT DETECTION: Did it catch the Week 3-4 drift toward thought leadership?\n");
  console.log("5. NON-OBVIOUS: Any insights you wouldn't have noticed yourself?\n");

  saveResults("test-2-strategist-reasoning", {
    test: "Strategist Reasoning (Multi-Step Agent with Tools)",
    pattern: "multi-step agent with custom tools",
    model: OPUS_MODEL,
    total_steps: step,
    tool_call_log: toolCallLog,
    tool_call_order: toolCallLog.map((t) => t.tool),
    reasoning: finalTextBlocks,
    directives_output: writeDirectivesOutput,
    scoring: {
      tool_order_logical: "FILL_IN: true / false",
      cross_referencing: "FILL_IN: 1-5 (5 = connects multiple data sources per insight)",
      specificity: "FILL_IN: count of specific, data-referencing directives",
      drift_detected: "FILL_IN: true / false",
      non_obvious_insights: "FILL_IN: list any insights you wouldn't have noticed",
      called_write_directives: writeDirectivesOutput !== null,
      notes: "FILL_IN: What impressed you? What was generic? What was wrong?",
      pass: "FILL_IN: true / false",
    },
  });
}

runTest().catch(console.error);
