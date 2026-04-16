import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { strategistMemory } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { runStrategistSession } from "../agents/strategist/session.js";

const runBody = z.object({
  type: z.enum(["weekly", "quarterly"]).default("weekly"),
});

export async function strategistRoutes(app: FastifyInstance) {
  // Trigger a Strategist run
  app.post("/api/strategist/run", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = runBody.parse(request.body);

    // Run async — return 202 immediately
    const runPromise = runStrategistSession(request.userId, body.type, app.log);

    // Don't await — let it run in the background
    runPromise
      .then((result) => {
        app.log.info({
          sessionId: result.sessionId,
          durationMs: result.durationMs,
          hasDirecives: !!result.directives,
          hasMonologue: !!result.monologue,
          error: result.error,
        }, "Strategist run complete");
      })
      .catch((err: any) => {
        app.log.error({
          err: err?.message,
          stack: err?.stack,
          status: err?.status,
          body: typeof err?.error === "string" ? err.error.slice(0, 500) : JSON.stringify(err?.error)?.slice(0, 500),
        }, "Strategist run FAILED");
      });

    return reply.status(202).send({
      status: "running",
      type: body.type,
      message: "Strategist run started. Check /api/strategist/latest for results.",
    });
  });

  // Get the latest Strategist output
  app.get("/api/strategist/latest", { onRequest: [app.authenticate] }, async (request) => {
    const latest = await db
      .select()
      .from(strategistMemory)
      .where(eq(strategistMemory.userId, request.userId))
      .orderBy(desc(strategistMemory.createdAt))
      .limit(1);

    return latest[0] ?? null;
  });

  // Get Strategist run history
  app.get("/api/strategist/history", { onRequest: [app.authenticate] }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "10", 10), 50);

    const history = await db
      .select({
        id: strategistMemory.id,
        weekOf: strategistMemory.weekOf,
        narrativeAssessment: strategistMemory.narrativeAssessment,
        driftScore: strategistMemory.driftScore,
        createdAt: strategistMemory.createdAt,
      })
      .from(strategistMemory)
      .where(eq(strategistMemory.userId, request.userId))
      .orderBy(desc(strategistMemory.createdAt))
      .limit(limit);

    return history;
  });
}
