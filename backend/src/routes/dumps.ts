import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { inputDumps } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { runPipeline } from "../services/pipeline.js";

const dumpBody = z.object({
  rawText: z.string().min(1),
  source: z.enum(["text", "voice"]).optional().default("text"),
});

export async function dumpRoutes(app: FastifyInstance) {
  // Submit a new brain dump
  app.post("/api/dumps", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = dumpBody.parse(request.body);

    const [dump] = await db
      .insert(inputDumps)
      .values({
        userId: request.userId,
        rawText: body.rawText,
        source: body.source,
        processingStatus: "pending",
      })
      .returning();

    // Trigger pipeline async
    runPipeline(dump.id, request.userId, app.log).catch((err) => {
      app.log.error({ err: err?.message, dumpId: dump.id }, "Pipeline trigger failed");
    });

    return reply.status(202).send({ id: dump.id, status: "processing" });
  });

  // List dumps with pagination
  app.get("/api/dumps", { onRequest: [app.authenticate] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "10", 10), 50);
    const offset = parseInt(query.offset || "0", 10);

    const dumps = await db
      .select()
      .from(inputDumps)
      .where(eq(inputDumps.userId, request.userId))
      .orderBy(desc(inputDumps.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ id: inputDumps.id })
      .from(inputDumps)
      .where(eq(inputDumps.userId, request.userId));

    return { dumps, total: countResult.length, limit, offset };
  });

  // Re-process a failed dump
  app.post("/api/dumps/:id/reprocess", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const dump = await db.query.inputDumps.findFirst({
      where: and(eq(inputDumps.id, id), eq(inputDumps.userId, request.userId)),
    });

    if (!dump) {
      return reply.status(404).send({ error: "Dump not found" });
    }

    if (dump.processingStatus === "completed") {
      return reply.status(400).send({ error: "Dump already processed successfully" });
    }

    // Reset and re-trigger
    await db
      .update(inputDumps)
      .set({ processingStatus: "pending", processingError: null })
      .where(eq(inputDumps.id, id));

    runPipeline(dump.id, request.userId, app.log).catch((err) => {
      app.log.error({ err: err?.message, dumpId: dump.id }, "Re-process trigger failed");
    });

    return reply.status(202).send({ id: dump.id, status: "reprocessing" });
  });
}
