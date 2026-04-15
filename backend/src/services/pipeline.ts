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

export async function runPipeline(dumpId: string, userId: string, logger: { error: (...args: any[]) => void; info: (...args: any[]) => void }) {
  try {
    // 1. Load dump
    const dump = await db.query.inputDumps.findFirst({
      where: eq(inputDumps.id, dumpId),
    });
    if (!dump) {
      logger.error({ dumpId }, "Pipeline: dump not found");
      return;
    }

    // 2. Load user config
    const config = await db.query.userConfig.findFirst({
      where: eq(userConfig.userId, userId),
    });
    if (!config) {
      logger.error({ userId }, "Pipeline: user config not found");
      return;
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

    const directives: string[] = latestStrategy.length > 0
      ? (latestStrategy[0].directives as string[])
      : [];

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

    // 6. Save opportunities
    for (const opp of noticingResult.opportunities) {
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

      // 7. For each opportunity, draft content for each suggested channel
      const channels = config.channels as string[];
      const targetChannels = opp.suggestedChannels.filter((ch) =>
        channels.includes(ch)
      );

      for (const channel of targetChannels) {
        try {
          const voiceContext = await getVoiceContext(userId, channel);

          logger.info(
            { dumpId, opportunityId: savedOpp.id, channel },
            "Pipeline: running Acting Agent"
          );

          const result = await runActingAgent({
            opportunityDescription: opp.description,
            angle: opp.angle,
            platform: channel,
            target: `${channel} post`,
            voiceContext,
            directives,
          });

          await db.insert(draftedContent).values({
            opportunityId: savedOpp.id,
            platform: channel as any,
            target: result.target,
            content: result.content,
            confidenceScore: result.confidenceScore,
            sourceTag: "brain_dump",
            reasoning: result.reasoning,
          });
        } catch (err) {
          logger.error(
            { err, dumpId, channel },
            "Pipeline: Acting Agent failed for channel"
          );
        }
      }
    }

    // 8. Update dump with emotional state and processedAt
    await db
      .update(inputDumps)
      .set({
        emotionalState: noticingResult.emotional_state,
        processedAt: new Date(),
      })
      .where(eq(inputDumps.id, dumpId));

    logger.info({ dumpId }, "Pipeline: complete");
  } catch (err) {
    logger.error({ err, dumpId }, "Pipeline: failed");
  }
}
