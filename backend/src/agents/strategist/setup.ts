/**
 * One-time bootstrap: create Anthropic Managed Agent + Environment,
 * store IDs in managed_agents_config for reuse across sessions.
 *
 * Uses the EXACT API pattern validated in test-managed-agent.ts.
 */

import { anthropic } from "../anthropic.js";
import { db } from "../../db/client.js";
import { managedAgentsConfig } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { strategistCustomTools } from "./tools.js";
import { env } from "../../config.js";

const AGENT_NAME = "strategist";

export async function getOrCreateStrategistSetup(
  userId: string,
  companyType: string
): Promise<{ agentId: string; environmentId: string }> {
  // Check if we already have a cached setup for this user
  const existing = await db
    .select({
      agentId: managedAgentsConfig.agentId,
      environmentId: managedAgentsConfig.environmentId,
    })
    .from(managedAgentsConfig)
    .where(
      and(
        eq(managedAgentsConfig.userId, userId),
        eq(managedAgentsConfig.agentName, AGENT_NAME)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      agentId: existing[0].agentId,
      environmentId: existing[0].environmentId,
    };
  }

  // Create new agent — disable ALL built-in tools, only custom tools
  // Matches validated pattern from test-managed-agent.ts
  const agent = await (anthropic.beta.agents as any).create({
    name: `ShipLoop Strategist (${companyType})`,
    model: env.STRATEGIST_MODEL,
    system: "You are the Strategist for ShipLoop. Your system prompt will be provided per session.",
    tools: [
      {
        type: "agent_toolset_20260401",
        default_config: { enabled: false },  // disable ALL built-in tools
      },
      ...strategistCustomTools,
    ],
  });

  // Create environment — minimal cloud container
  const environment = await (anthropic.beta.environments as any).create({
    name: `shiploop-strategist-${userId.slice(0, 8)}`,
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });

  // Store in DB
  await db.insert(managedAgentsConfig).values({
    userId,
    agentName: AGENT_NAME,
    agentId: agent.id,
    agentVersion: agent.version ?? 1,
    environmentId: environment.id,
  });

  return {
    agentId: agent.id,
    environmentId: environment.id,
  };
}
