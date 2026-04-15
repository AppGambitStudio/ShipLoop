import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { assets } from "../db/schema.js";
import { eq } from "drizzle-orm";

const assetBody = z.object({
  name: z.string().min(1),
  oneLiner: z.string().min(1),
  category: z.enum(["open_source", "product", "content", "talk"]),
  githubUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  targetAudience: z.string().min(1),
});

export async function assetRoutes(app: FastifyInstance) {
  app.get("/api/assets", { onRequest: [app.authenticate] }, async (request) => {
    const userAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, request.userId));
    return userAssets;
  });

  app.post("/api/assets", { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = assetBody.parse(request.body);

    const [created] = await db
      .insert(assets)
      .values({
        userId: request.userId,
        name: body.name,
        oneLiner: body.oneLiner,
        category: body.category,
        githubUrl: body.githubUrl ?? null,
        liveUrl: body.liveUrl ?? null,
        targetAudience: body.targetAudience,
      })
      .returning();

    return reply.status(201).send(created);
  });
}
