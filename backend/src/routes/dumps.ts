import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { inputDumps } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { runPipeline } from "../services/pipeline.js";

const dumpBody = z.object({
  rawText: z.string().min(1),
  source: z.enum(["text", "voice"]).optional().default("text"),
});

export async function dumpRoutes(app: FastifyInstance) {
  app.post("/api/dumps", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = dumpBody.parse(request.body);

    const [dump] = await db
      .insert(inputDumps)
      .values({
        userId: request.userId,
        rawText: body.rawText,
        source: body.source,
      })
      .returning();

    // Trigger pipeline async — don't block response
    runPipeline(dump.id, request.userId, app.log).catch((err) => {
      app.log.error({ err, dumpId: dump.id }, "Pipeline failed");
    });

    return reply.status(202).send({ id: dump.id, status: "processing" });
  });

  app.get("/api/dumps", { onRequest: [app.authenticate] }, async (request) => {
    const dumps = await db
      .select()
      .from(inputDumps)
      .where(eq(inputDumps.userId, request.userId))
      .orderBy(desc(inputDumps.createdAt))
      .limit(20);
    return dumps;
  });
}
