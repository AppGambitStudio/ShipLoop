import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { postedContent, draftedContent, opportunities, inputDumps } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const postBody = z.object({
  draftId: z.string().uuid(),
  postUrl: z.string().url(),
  platformPostId: z.string().optional(),
});

export async function postedRoutes(app: FastifyInstance) {
  // Report that an approved draft was manually posted
  app.post("/api/posted", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = postBody.parse(request.body);

    // Verify the draft belongs to this user and is approved/edited
    const draft = await db
      .select({ id: draftedContent.id, approvalStatus: draftedContent.approvalStatus })
      .from(draftedContent)
      .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
      .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
      .where(
        and(
          eq(draftedContent.id, body.draftId),
          eq(inputDumps.userId, request.userId)
        )
      )
      .limit(1);

    if (draft.length === 0) {
      return reply.status(404).send({ error: "Draft not found" });
    }

    if (!["approved", "edited"].includes(draft[0].approvalStatus)) {
      return reply.status(400).send({ error: "Draft must be approved before reporting as posted" });
    }

    const [posted] = await db
      .insert(postedContent)
      .values({
        draftedContentId: body.draftId,
        postUrl: body.postUrl,
        platformPostId: body.platformPostId || null,
        postedAt: new Date(),
      })
      .returning();

    return reply.status(201).send(posted);
  });

  // List posted content
  app.get("/api/posted", { onRequest: [app.authenticate] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "10", 10), 50);
    const offset = parseInt(query.offset || "0", 10);

    const results = await db
      .select({
        id: postedContent.id,
        postUrl: postedContent.postUrl,
        postedAt: postedContent.postedAt,
        upvotes: postedContent.upvotes,
        comments: postedContent.comments,
        tractionFlag: postedContent.tractionFlag,
        platform: draftedContent.platform,
        content: draftedContent.content,
      })
      .from(postedContent)
      .innerJoin(draftedContent, eq(postedContent.draftedContentId, draftedContent.id))
      .innerJoin(opportunities, eq(draftedContent.opportunityId, opportunities.id))
      .innerJoin(inputDumps, eq(opportunities.inputDumpId, inputDumps.id))
      .where(eq(inputDumps.userId, request.userId))
      .orderBy(desc(postedContent.postedAt))
      .limit(limit)
      .offset(offset);

    return results;
  });
}
