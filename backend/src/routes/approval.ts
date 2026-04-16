import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  draftedContent,
  opportunities,
  inputDumps,
  voiceProfileEntries,
} from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { analyzeDiff } from "../agents/diff-analysis.js";

const editBody = z.object({
  editedContent: z.string().min(1),
});

const skipBody = z.object({
  reason: z.enum(["tone_wrong", "angle_wrong", "timing_wrong", "too_generic", "other"]),
  reasonText: z.string().optional(),
});

export async function approvalRoutes(app: FastifyInstance) {
  // GET /api/drafts/pending — list pending drafts for user with pagination
  app.get("/api/drafts/pending", { onRequest: [app.authenticate] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "10", 10), 50);
    const offset = parseInt(query.offset || "0", 10);

    const results = await db
      .select({
        id: draftedContent.id,
        platform: draftedContent.platform,
        target: draftedContent.target,
        content: draftedContent.content,
        confidenceScore: draftedContent.confidenceScore,
        reasoning: draftedContent.reasoning,
        sourceTag: draftedContent.sourceTag,
        createdAt: draftedContent.createdAt,
        opportunityId: draftedContent.opportunityId,
        description: opportunities.description,
        angle: opportunities.angle,
        urgency: opportunities.urgency,
        dumpCreatedAt: inputDumps.createdAt,
      })
      .from(draftedContent)
      .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
      .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
      .where(
        and(
          eq(inputDumps.userId, request.userId),
          eq(draftedContent.approvalStatus, "pending")
        )
      )
      .orderBy(desc(draftedContent.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ id: draftedContent.id })
      .from(draftedContent)
      .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
      .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
      .where(
        and(
          eq(inputDumps.userId, request.userId),
          eq(draftedContent.approvalStatus, "pending")
        )
      );

    return {
      drafts: results,
      total: countResult.length,
      limit,
      offset,
    };
  });

  // GET /api/drafts/stats — counts by approval status
  app.get("/api/drafts/stats", { onRequest: [app.authenticate] }, async (request) => {
    const allDrafts = await db
      .select({
        approvalStatus: draftedContent.approvalStatus,
      })
      .from(draftedContent)
      .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
      .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
      .where(eq(inputDumps.userId, request.userId));

    const stats = { total: 0, pending: 0, approved: 0, edited: 0, skipped: 0, expired: 0 };
    for (const d of allDrafts) {
      stats.total++;
      const s = d.approvalStatus as keyof typeof stats;
      if (s in stats) stats[s]++;
    }

    return stats;
  });

  // POST /api/drafts/:id/approve
  app.post("/api/drafts/:id/approve", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership via join
    const draft = await getDraftForUser(id, request.userId);
    if (!draft) {
      return reply.status(404).send({ error: "Draft not found" });
    }

    await db
      .update(draftedContent)
      .set({
        approvalStatus: "approved",
        approvedContent: draft.content,
        approvedAt: new Date(),
      })
      .where(eq(draftedContent.id, id));

    // Save to voice profile
    await db.insert(voiceProfileEntries).values({
      userId: request.userId,
      platform: draft.platform as any,
      entryType: "approved_post",
      draftedContentId: id,
      finalContent: draft.content,
      weight: 1.0,
    });

    return { status: "approved" };
  });

  // POST /api/drafts/:id/edit
  app.post("/api/drafts/:id/edit", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = editBody.parse(request.body);

    const draft = await getDraftForUser(id, request.userId);
    if (!draft) {
      return reply.status(404).send({ error: "Draft not found" });
    }

    await db
      .update(draftedContent)
      .set({
        approvalStatus: "edited",
        approvedContent: body.editedContent,
        approvedAt: new Date(),
      })
      .where(eq(draftedContent.id, id));

    // Analyze diff categories (async — don't block response)
    let diffCategories = null;
    try {
      diffCategories = await analyzeDiff(draft.content, body.editedContent);
    } catch (err) {
      // Diff analysis failure is non-critical — log and continue
      app.log.error({ err, draftId: id }, "Diff analysis failed");
    }

    // Save to voice profile with higher weight (edit diffs are most valuable)
    await db.insert(voiceProfileEntries).values({
      userId: request.userId,
      platform: draft.platform as any,
      entryType: "edit_diff",
      draftedContentId: id,
      originalContent: draft.content,
      finalContent: body.editedContent,
      diffCategories,
      weight: 2.0,
    });

    return { status: "edited" };
  });

  // POST /api/drafts/:id/skip
  app.post("/api/drafts/:id/skip", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = skipBody.parse(request.body);

    const draft = await getDraftForUser(id, request.userId);
    if (!draft) {
      return reply.status(404).send({ error: "Draft not found" });
    }

    await db
      .update(draftedContent)
      .set({
        approvalStatus: "skipped",
        skipReason: body.reason,
        skipReasonText: body.reasonText ?? null,
      })
      .where(eq(draftedContent.id, id));

    // Save to voice profile
    await db.insert(voiceProfileEntries).values({
      userId: request.userId,
      platform: draft.platform as any,
      entryType: "skip_signal",
      draftedContentId: id,
      originalContent: draft.content,
      skipReason: body.reason,
      weight: 1.5,
    });

    return { status: "skipped" };
  });
}

async function getDraftForUser(draftId: string, userId: string) {
  const results = await db
    .select({
      id: draftedContent.id,
      content: draftedContent.content,
      platform: draftedContent.platform,
      approvalStatus: draftedContent.approvalStatus,
    })
    .from(draftedContent)
    .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
    .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
    .where(
      and(
        eq(draftedContent.id, draftId),
        eq(inputDumps.userId, userId)
      )
    )
    .limit(1);

  return results[0] ?? null;
}
