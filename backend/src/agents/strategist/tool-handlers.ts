/**
 * Custom tool handlers for the Strategist Managed Agent.
 *
 * Each handler queries Postgres and returns a JSON-serializable object.
 * The dispatcher maps tool names from the agent to the correct handler.
 */

import { db } from "../../db/client.js";
import {
  assets,
  strategistMemory,
  userConfig,
  postedContent,
  draftedContent,
  opportunities,
  inputDumps,
  voiceProfileEntries,
} from "../../db/schema.js";
import { eq, and, desc, gte } from "drizzle-orm";

// ── Individual tool handlers ──────────────────────────────

export async function readAssetRegistry(userId: string) {
  const rows = await db
    .select({
      id: assets.id,
      name: assets.name,
      category: assets.category,
      oneLiner: assets.oneLiner,
      distributionStatus: assets.distributionStatus,
      priorityScore: assets.priorityScore,
      lastDistributedAt: assets.lastDistributedAt,
      targetAudience: assets.targetAudience,
    })
    .from(assets)
    .where(eq(assets.userId, userId));

  return { assets: rows, count: rows.length };
}

export async function readPostedContent(userId: string, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = await db
    .select({
      id: postedContent.id,
      platform: draftedContent.platform,
      content: draftedContent.content,
      approvedContent: draftedContent.approvedContent,
      confidenceScore: draftedContent.confidenceScore,
      approvalStatus: draftedContent.approvalStatus,
      postUrl: postedContent.postUrl,
      postedAt: postedContent.postedAt,
      upvotes: postedContent.upvotes,
      comments: postedContent.comments,
      tractionFlag: postedContent.tractionFlag,
      opportunityDescription: opportunities.description,
      opportunityAngle: opportunities.angle,
    })
    .from(postedContent)
    .innerJoin(draftedContent, eq(postedContent.draftedContentId, draftedContent.id))
    .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
    .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
    .where(
      and(
        eq(inputDumps.userId, userId),
        gte(postedContent.postedAt, cutoff)
      )
    )
    .orderBy(desc(postedContent.postedAt));

  return { posts: rows, count: rows.length, daysBack: days };
}

export async function readInternalMonologue(userId: string, count: number) {
  const rows = await db
    .select({
      id: strategistMemory.id,
      weekOf: strategistMemory.weekOf,
      internalMonologue: strategistMemory.internalMonologue,
      directives: strategistMemory.directives,
      narrativeAssessment: strategistMemory.narrativeAssessment,
      driftScore: strategistMemory.driftScore,
      pathSimulation: strategistMemory.pathSimulation,
    })
    .from(strategistMemory)
    .where(eq(strategistMemory.userId, userId))
    .orderBy(desc(strategistMemory.weekOf))
    .limit(count);

  return { entries: rows, count: rows.length };
}

export async function readUserConfig(userId: string) {
  const rows = await db
    .select({
      id: userConfig.id,
      companyType: userConfig.companyType,
      goalStatement: userConfig.goalStatement,
      channels: userConfig.channels,
      signalDefinitions: userConfig.signalDefinitions,
      competitors: userConfig.competitors,
      silenceThresholdDays: userConfig.silenceThresholdDays,
      burnoutProtocolDays: userConfig.burnoutProtocolDays,
      queueExpiryHours: userConfig.queueExpiryHours,
    })
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return { error: "No user config found. The user has not completed onboarding." };
  }

  return { config: rows[0] };
}

export async function readApprovalPatterns(userId: string, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Get all drafted content in the date range for this user
  const drafts = await db
    .select({
      id: draftedContent.id,
      approvalStatus: draftedContent.approvalStatus,
      skipReason: draftedContent.skipReason,
      platform: draftedContent.platform,
      createdAt: draftedContent.createdAt,
    })
    .from(draftedContent)
    .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
    .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
    .where(
      and(
        eq(inputDumps.userId, userId),
        gte(draftedContent.createdAt, cutoff)
      )
    );

  // Aggregate counts by approval status
  const statusCounts: Record<string, number> = {};
  for (const d of drafts) {
    statusCounts[d.approvalStatus] = (statusCounts[d.approvalStatus] || 0) + 1;
  }

  // Aggregate skip reason distribution
  const skipReasons: Record<string, number> = {};
  for (const d of drafts) {
    if (d.approvalStatus === "skipped" && d.skipReason) {
      skipReasons[d.skipReason] = (skipReasons[d.skipReason] || 0) + 1;
    }
  }

  // Get voice profile edit diffs for the date range
  const editDiffs = await db
    .select({
      platform: voiceProfileEntries.platform,
      entryType: voiceProfileEntries.entryType,
      diffCategories: voiceProfileEntries.diffCategories,
    })
    .from(voiceProfileEntries)
    .where(
      and(
        eq(voiceProfileEntries.userId, userId),
        eq(voiceProfileEntries.entryType, "edit_diff"),
        gte(voiceProfileEntries.createdAt, cutoff)
      )
    );

  // Summarize diff categories
  const diffCategoryCounts: Record<string, number> = {};
  for (const entry of editDiffs) {
    if (entry.diffCategories && typeof entry.diffCategories === "object") {
      const categories = entry.diffCategories as Record<string, unknown>;
      for (const cat of Object.keys(categories)) {
        diffCategoryCounts[cat] = (diffCategoryCounts[cat] || 0) + 1;
      }
    }
  }

  return {
    daysBack: days,
    totalDrafts: drafts.length,
    statusCounts,
    skipReasons,
    editDiffCategories: diffCategoryCounts,
    editDiffCount: editDiffs.length,
  };
}

export async function writeDirectives(
  userId: string,
  data: {
    directives: Record<string, unknown>;
    narrativeAssessment: string;
    driftScore: number;
    pathSimulation?: { pathA: string; pathB: string } | null;
  }
) {
  // Get the user's current goal statement for the snapshot
  const configRows = await db
    .select({ goalStatement: userConfig.goalStatement })
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);

  const goalsSnapshot = configRows[0]?.goalStatement ?? "No goal set";

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const [row] = await db
    .insert(strategistMemory)
    .values({
      userId,
      weekOf: today,
      internalMonologue: "", // Will be filled by writeMonologue
      directives: data.directives,
      priorityAssets: data.directives.priorityAssetIds ?? [],
      narrativeAssessment: data.narrativeAssessment,
      driftScore: data.driftScore,
      pathSimulation: data.pathSimulation ?? null,
      goalsSnapshot,
    })
    .returning({ id: strategistMemory.id });

  return { success: true, memoryId: row.id, weekOf: today };
}

export async function writeMonologue(userId: string, monologue: string) {
  // Update the most recent strategist memory row (created by writeDirectives)
  const latest = await db
    .select({ id: strategistMemory.id })
    .from(strategistMemory)
    .where(eq(strategistMemory.userId, userId))
    .orderBy(desc(strategistMemory.createdAt))
    .limit(1);

  if (latest.length === 0) {
    return { error: "No strategist memory entry found. Call write_directives first." };
  }

  await db
    .update(strategistMemory)
    .set({ internalMonologue: monologue })
    .where(eq(strategistMemory.id, latest[0].id));

  return { success: true, memoryId: latest[0].id };
}

// ── Dispatcher ────────────────────────────────────────────

export async function handleCustomToolCall(
  toolName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<object> {
  switch (toolName) {
    case "read_asset_registry":
      return readAssetRegistry(userId);

    case "read_posted_content":
      return readPostedContent(userId, (input.days as number) ?? 30);

    case "read_internal_monologue":
      return readInternalMonologue(userId, (input.count as number) ?? 2);

    case "read_user_config":
      return readUserConfig(userId);

    case "read_approval_patterns":
      return readApprovalPatterns(userId, (input.days as number) ?? 30);

    case "write_directives":
      return writeDirectives(userId, {
        directives: input.directives as Record<string, unknown>,
        narrativeAssessment: input.narrativeAssessment as string,
        driftScore: input.driftScore as number,
        pathSimulation: input.pathSimulation as { pathA: string; pathB: string } | undefined,
      });

    case "write_monologue":
      return writeMonologue(userId, input.monologue as string);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
