/**
 * One-time bootstrap: create Anthropic Managed Agent + Environment,
 * store IDs in managed_agents_config for reuse across sessions.
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

  // Create new agent — disable all built-in tools, only use custom tools
  const agent = await (anthropic.beta.agents as any).create({
    model: env.STRATEGIST_MODEL,
    name: `shiploop-strategist-${companyType}`,
    description: `ShipLoop Strategist agent for a ${companyType} builder. Runs weekly/quarterly to issue distribution directives.`,
    tools: strategistCustomTools,
    // Disable all built-in tools — strategist only uses our custom tools
  });

  // Create environment for persistent state
  const environment = await (anthropic.beta.environments as any).create(agent.id);

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
