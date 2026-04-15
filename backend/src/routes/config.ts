import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { userConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";

const configBody = z.object({
  companyType: z.enum(["service_company", "saas_founder", "solo_creator", "indie_builder"]),
  goalStatement: z.string().min(1),
  channels: z.array(z.string()).min(1),
  signalDefinitions: z.record(z.string(), z.any()).optional().default({}),
  competitors: z.array(z.string()).optional().default([]),
  silenceThresholdDays: z.number().optional(),
  burnoutProtocolDays: z.number().optional(),
  queueExpiryHours: z.number().optional(),
});

export async function configRoutes(app: FastifyInstance) {
  app.get("/api/config", { onRequest: [app.authenticate] }, async (request) => {
    const config = await db.query.userConfig.findFirst({
      where: eq(userConfig.userId, request.userId),
    });
    return config ?? null;
  });

  app.put("/api/config", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = configBody.parse(request.body);

    const existing = await db.query.userConfig.findFirst({
      where: eq(userConfig.userId, request.userId),
    });

    if (existing) {
      const [updated] = await db
        .update(userConfig)
        .set({
          companyType: body.companyType,
          goalStatement: body.goalStatement,
          channels: body.channels,
          signalDefinitions: body.signalDefinitions,
          competitors: body.competitors,
          silenceThresholdDays: body.silenceThresholdDays,
          burnoutProtocolDays: body.burnoutProtocolDays,
          queueExpiryHours: body.queueExpiryHours,
          updatedAt: new Date(),
        })
        .where(eq(userConfig.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userConfig)
      .values({
        userId: request.userId,
        companyType: body.companyType,
        goalStatement: body.goalStatement,
        channels: body.channels,
        signalDefinitions: body.signalDefinitions,
        competitors: body.competitors,
        silenceThresholdDays: body.silenceThresholdDays,
        burnoutProtocolDays: body.burnoutProtocolDays,
        queueExpiryHours: body.queueExpiryHours,
      })
      .returning();

    return reply.status(201).send(created);
  });
}
