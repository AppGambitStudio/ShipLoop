/**
 * Core session runner for the Strategist Managed Agent.
 *
 * Creates an Anthropic session, opens a stream, sends the trigger prompt,
 * and processes events in a loop — executing custom tools as requested.
 */

import { anthropic } from "../anthropic.js";
import { db } from "../../db/client.js";
import { managedAgentsConfig, userConfig } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getOrCreateStrategistSetup } from "./setup.js";
import { buildStrategistSystemPrompt } from "./system-prompt.js";
import { handleCustomToolCall } from "./tool-handlers.js";
import type { StrategistRunResult, StrategistDirectives } from "./types.js";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface Logger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

export async function runStrategistSession(
  userId: string,
  type: "weekly" | "quarterly",
  logger: Logger
): Promise<StrategistRunResult> {
  const startTime = Date.now();
  const agentMessages: string[] = [];
  const toolCallsLog: Array<{ tool: string; input: unknown; timestamp: string }> = [];
  let collectedDirectives: StrategistDirectives | null = null;
  let collectedMonologue: string | null = null;
  let collectedNarrativeAssessment: string | null = null;
  let collectedDriftScore: number | null = null;
  let collectedPathSimulation: { pathA: string; pathB: string } | null = null;
  let sessionId = "";

  try {
    // 1. Load user config for company type
    logger.info({ userId }, "Loading user config");
    const configRows = await db
      .select({
        companyType: userConfig.companyType,
      })
      .from(userConfig)
      .where(eq(userConfig.userId, userId))
      .limit(1);

    if (configRows.length === 0) {
      return buildErrorResult("User has not completed onboarding — no config found", startTime);
    }

    const companyType = configRows[0].companyType;

    // 2. Get or create agent + environment
    logger.info({ userId, companyType }, "Setting up Strategist agent");
    const { agentId, environmentId } = await getOrCreateStrategistSetup(userId, companyType);

    // 3. Get last run date
    const agentConfigRows = await db
      .select({ lastRunAt: managedAgentsConfig.lastRunAt })
      .from(managedAgentsConfig)
      .where(
        and(
          eq(managedAgentsConfig.userId, userId),
          eq(managedAgentsConfig.agentName, "strategist")
        )
      )
      .limit(1);

    const lastRunDate = agentConfigRows[0]?.lastRunAt ?? null;

    // 4. Build system prompt
    const isQuarterly = type === "quarterly";
    const systemPrompt = buildStrategistSystemPrompt(companyType, isQuarterly, lastRunDate);

    // 5. Create session
    logger.info({ userId, agentId, type }, "Creating Strategist session");
    const session = await (anthropic.beta.sessions as any).create(agentId, {
      environment_id: environmentId,
      system: systemPrompt,
    });
    sessionId = session.id;
    logger.info({ sessionId }, "Session created");

    // 6. Open stream BEFORE sending message (validated API pattern)
    const stream = await (anthropic.beta.sessions as any).events.stream(session.id);

    // 7. Send trigger message
    const triggerMessage = isQuarterly
      ? "Run your quarterly strategic review. Read 4 monologue entries, 90 days of posted content and approval patterns. Compute drift score and simulate paths if needed. Issue updated directives."
      : "Run your weekly strategic review. Read your last 2 monologue entries, 30 days of posted content and approval patterns. Assess what changed, issue updated directives.";

    await (anthropic.beta.sessions as any).events.send(session.id, {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: triggerMessage }],
        },
      ],
    });

    logger.info({ sessionId }, "Trigger message sent, processing events");

    // 8. Process events in loop with timeout
    const toolEvents: Record<string, { name: string; input: Record<string, unknown> }> = {};
    let done = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Strategist session timed out after 5 minutes")), SESSION_TIMEOUT_MS);
    });

    const processEvents = async () => {
      for await (const event of stream) {
        const elapsed = Date.now() - startTime;
        if (elapsed > SESSION_TIMEOUT_MS) {
          throw new Error("Strategist session timed out after 5 minutes");
        }

        switch (event.type) {
          case "agent.custom_tool_use": {
            const e = event as any;
            toolEvents[e.id] = { name: e.name, input: e.input };
            logger.info({ tool: e.name, eventId: e.id }, "Agent requested tool call");
            break;
          }

          case "agent.message": {
            const e = event as any;
            // Collect text from agent messages
            if (e.content) {
              for (const block of e.content) {
                if (block.type === "text" && block.text) {
                  agentMessages.push(block.text);
                }
              }
            }
            break;
          }

          case "session.status_idle": {
            const e = event as any;
            if (e.stop_reason?.type === "requires_action") {
              // Execute each requested tool
              for (const eventId of e.stop_reason.event_ids) {
                const toolEvent = toolEvents[eventId];
                if (!toolEvent) {
                  logger.warn({ eventId }, "Tool event ID not found in cache");
                  continue;
                }

                logger.info({ tool: toolEvent.name }, "Executing tool");
                toolCallsLog.push({
                  tool: toolEvent.name,
                  input: toolEvent.input,
                  timestamp: new Date().toISOString(),
                });

                try {
                  const result = await handleCustomToolCall(toolEvent.name, toolEvent.input, userId);

                  // Capture directives and monologue from write calls
                  if (toolEvent.name === "write_directives") {
                    const input = toolEvent.input;
                    collectedDirectives = (input.directives as StrategistDirectives) ?? null;
                    collectedNarrativeAssessment = (input.narrativeAssessment as string) ?? null;
                    collectedDriftScore = (input.driftScore as number) ?? null;
                    collectedPathSimulation = (input.pathSimulation as { pathA: string; pathB: string }) ?? null;
                  }
                  if (toolEvent.name === "write_monologue") {
                    collectedMonologue = (toolEvent.input.monologue as string) ?? null;
                  }

                  // Send result back — content MUST be array, field is custom_tool_use_id
                  await (anthropic.beta.sessions as any).events.send(session.id, {
                    events: [
                      {
                        type: "user.custom_tool_result",
                        custom_tool_use_id: eventId,
                        content: [{ type: "text", text: JSON.stringify(result) }],
                      },
                    ],
                  });
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message : String(err);
                  logger.error({ tool: toolEvent.name, err: errorMsg }, "Tool execution failed");

                  await (anthropic.beta.sessions as any).events.send(session.id, {
                    events: [
                      {
                        type: "user.custom_tool_result",
                        custom_tool_use_id: eventId,
                        content: [{ type: "text", text: JSON.stringify({ error: errorMsg }) }],
                      },
                    ],
                  });
                }
              }
            } else if (e.stop_reason?.type === "end_turn") {
              logger.info({ sessionId }, "Agent finished (end_turn)");
              done = true;
            }
            break;
          }

          case "session.error": {
            const e = event as any;
            const errorMsg = e.error?.message ?? "Unknown session error";
            logger.error({ sessionId, error: errorMsg }, "Session error");
            throw new Error(`Session error: ${errorMsg}`);
          }

          case "session.status_terminated": {
            logger.error({ sessionId }, "Session terminated unexpectedly");
            throw new Error("Session terminated unexpectedly");
          }
        }

        if (done) break;
      }
    };

    await Promise.race([processEvents(), timeoutPromise]);

    // 9. Update managed_agents_config with session info
    await db
      .update(managedAgentsConfig)
      .set({
        lastSessionId: sessionId,
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(managedAgentsConfig.userId, userId),
          eq(managedAgentsConfig.agentName, "strategist")
        )
      );

    logger.info(
      { sessionId, durationMs: Date.now() - startTime, toolCalls: toolCallsLog.length },
      "Strategist session completed"
    );

    // 10. Return result
    return {
      sessionId,
      monologue: collectedMonologue,
      directives: collectedDirectives,
      narrativeAssessment: collectedNarrativeAssessment,
      driftScore: collectedDriftScore,
      pathSimulation: collectedPathSimulation,
      agentMessages,
      toolCallsLog,
      error: null,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ sessionId, err: errorMsg }, "Strategist session failed");

    return {
      sessionId,
      monologue: collectedMonologue,
      directives: collectedDirectives,
      narrativeAssessment: collectedNarrativeAssessment,
      driftScore: collectedDriftScore,
      pathSimulation: collectedPathSimulation,
      agentMessages,
      toolCallsLog,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    };
  }
}

function buildErrorResult(error: string, startTime: number): StrategistRunResult {
  return {
    sessionId: "",
    monologue: null,
    directives: null,
    narrativeAssessment: null,
    driftScore: null,
    pathSimulation: null,
    agentMessages: [],
    toolCallsLog: [],
    error,
    durationMs: Date.now() - startTime,
  };
}
