import { db } from "../db/client.js";
import {
  inputDumps,
  userConfig,
  assets,
  opportunities,
  draftedContent,
  strategistMemory,
} from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { runNoticingAgent } from "../agents/noticing.js";
import { runActingAgent } from "../agents/acting.js";
import { getVoiceContext } from "./voice-profile.js";

interface Logger {
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
}

export async function runPipeline(dumpId: string, userId: string, logger: Logger) {
  // Mark as processing
  await db
    .update(inputDumps)
    .set({ processingStatus: "processing", processingError: null })
    .where(eq(inputDumps.id, dumpId));

  try {
    // 1. Load dump
    const dump = await db.query.inputDumps.findFirst({
      where: eq(inputDumps.id, dumpId),
    });
    if (!dump) {
      throw new Error(`Dump ${dumpId} not found`);
    }

    // 2. Load user config
    const config = await db.query.userConfig.findFirst({
      where: eq(userConfig.userId, userId),
    });
    if (!config) {
      throw new Error("User config not found. Please complete onboarding first.");
    }

    // 3. Load assets
    const userAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId));

    // 4. Load latest strategist directives
    const latestStrategy = await db
      .select()
      .from(strategistMemory)
      .where(eq(strategistMemory.userId, userId))
      .orderBy(desc(strategistMemory.createdAt))
      .limit(1);

    const directives: Record<string, unknown> | null = latestStrategy.length > 0
      ? (latestStrategy[0].directives as Record<string, unknown>)
      : null;

    // 5. Run Noticing Agent
    logger.info({ dumpId }, "Pipeline: running Noticing Agent");
    const noticingResult = await runNoticingAgent({
      rawText: dump.rawText,
      companyType: config.companyType,
      assets: userAssets.map((a) => ({
        name: a.name,
        oneLiner: a.oneLiner,
        category: a.category,
        targetAudience: a.targetAudience,
      })),
      directives,
    });

    logger.info(
      { dumpId, opportunities: noticingResult.opportunities.length, emotion: noticingResult.emotional_state },
      "Pipeline: Noticing Agent complete"
    );

    // Filter out low-relevance opportunities when stressed
    let filteredOpps = noticingResult.opportunities;
    if (noticingResult.emotional_state === "stressed") {
      // Only keep opportunities with high relevance when the user is stressed
      filteredOpps = filteredOpps.filter((opp) => opp.relevanceScore >= 0.7);
      if (filteredOpps.length < noticingResult.opportunities.length) {
        logger.info(
          { dumpId, before: noticingResult.opportunities.length, after: filteredOpps.length },
          "Pipeline: filtered low-relevance opportunities (stressed state)"
        );
      }
    }

    if (filteredOpps.length === 0) {
      // No opportunities worth drafting — still a success
      await db
        .update(inputDumps)
        .set({
          emotionalState: noticingResult.emotional_state,
          processingStatus: "completed",
          processingError: null,
          processedAt: new Date(),
        })
        .where(eq(inputDumps.id, dumpId));
      logger.info({ dumpId, emotion: noticingResult.emotional_state }, "Pipeline: complete (no actionable opportunities)");
      return;
    }

    // 6. Save opportunities and draft content
    // Hard caps: max 2 opportunities, max 2 channels per opportunity = max 4 drafts per dump
    const MAX_OPPORTUNITIES = 2;
    const MAX_CHANNELS_PER_OPP = 2;

    const cappedOpportunities = filteredOpps
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MAX_OPPORTUNITIES);

    logger.info(
      { dumpId, total: noticingResult.opportunities.length, capped: cappedOpportunities.length },
      "Pipeline: opportunities capped"
    );

    const configChannels = (config.channels as string[]) || [];
    let totalDrafts = 0;

    for (const opp of cappedOpportunities) {
      // Match asset by name
      const matchedAsset = opp.assetName
        ? userAssets.find(
            (a) => a.name.toLowerCase() === opp.assetName!.toLowerCase()
          )
        : null;

      const [savedOpp] = await db
        .insert(opportunities)
        .values({
          inputDumpId: dumpId,
          assetId: matchedAsset?.id ?? null,
          description: opp.description,
          angle: opp.angle,
          urgency: opp.urgency,
          relevanceScore: opp.relevanceScore,
          suggestedChannels: opp.suggestedChannels,
        })
        .returning();

      // Filter channels: match base platform name, then cap at MAX_CHANNELS_PER_OPP
      const targetChannels = opp.suggestedChannels
        .filter((ch) => {
          const basePlatform = ch.split(":")[0];
          return configChannels.includes(basePlatform) || configChannels.includes(ch);
        })
        .slice(0, MAX_CHANNELS_PER_OPP);

      if (targetChannels.length === 0) {
        logger.info(
          { dumpId, opportunity: opp.description, suggested: opp.suggestedChannels, configured: configChannels },
          "Pipeline: no matching channels for opportunity"
        );
      }

      for (const channel of targetChannels) {
        try {
          const basePlatform = channel.split(":")[0];
          const target = channel.includes(":") ? channel.split(":").slice(1).join(":") : "main";
          const voiceContext = await getVoiceContext(userId, basePlatform);

          logger.info({ dumpId, channel }, "Pipeline: running Acting Agent");

          const result = await runActingAgent({
            opportunityDescription: opp.description,
            angle: opp.angle,
            platform: basePlatform,
            target,
            voiceContext,
            directives,
          });

          await db.insert(draftedContent).values({
            opportunityId: savedOpp.id,
            platform: basePlatform as any,
            target: result.target,
            content: result.content,
            confidenceScore: result.confidenceScore,
            sourceTag: "brain_dump",
            reasoning: result.reasoning,
          });
          totalDrafts++;
        } catch (err: any) {
          logger.error(
            { err: err?.message, dumpId, channel },
            "Pipeline: Acting Agent failed for channel"
          );
          // Continue with other channels — don't fail the whole pipeline
        }
      }
    }

    // 7. Mark as completed
    await db
      .update(inputDumps)
      .set({
        emotionalState: noticingResult.emotional_state,
        processingStatus: "completed",
        processingError: null,
        processedAt: new Date(),
      })
      .where(eq(inputDumps.id, dumpId));

    logger.info({ dumpId, totalDrafts }, "Pipeline: complete");
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    logger.error({ err: errorMessage, stack: err?.stack, dumpId }, "Pipeline: FAILED");

    // Mark as failed with error message
    await db
      .update(inputDumps)
      .set({
        processingStatus: "failed",
        processingError: errorMessage,
      })
      .where(eq(inputDumps.id, dumpId));
  }
}
