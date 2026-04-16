import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { voiceProfileEntries } from "../db/schema.js";
import { eq, desc, and, sql } from "drizzle-orm";

export async function voiceProfileRoutes(app: FastifyInstance) {
  // GET /api/voice-profile/stats — voice profile health summary
  app.get("/api/voice-profile/stats", { onRequest: [app.authenticate] }, async (request) => {
    const entries = await db
      .select({
        platform: voiceProfileEntries.platform,
        entryType: voiceProfileEntries.entryType,
        createdAt: voiceProfileEntries.createdAt,
      })
      .from(voiceProfileEntries)
      .where(eq(voiceProfileEntries.userId, request.userId));

    // Group by platform
    const byPlatform: Record<string, { approved: number; edits: number; skips: number; engagement: number; total: number; latest: string | null }> = {};

    for (const entry of entries) {
      const p = entry.platform;
      if (!byPlatform[p]) {
        byPlatform[p] = { approved: 0, edits: 0, skips: 0, engagement: 0, total: 0, latest: null };
      }
      byPlatform[p].total++;
      if (entry.entryType === "approved_post") byPlatform[p].approved++;
      else if (entry.entryType === "edit_diff") byPlatform[p].edits++;
      else if (entry.entryType === "skip_signal") byPlatform[p].skips++;
      else if (entry.entryType === "engagement_signal") byPlatform[p].engagement++;

      const ts = entry.createdAt.toISOString();
      if (!byPlatform[p].latest || ts > byPlatform[p].latest!) {
        byPlatform[p].latest = ts;
      }
    }

    // Calculate overall health
    const totalEntries = entries.length;
    const totalApproved = entries.filter((e) => e.entryType === "approved_post").length;
    const totalEdits = entries.filter((e) => e.entryType === "edit_diff").length;
    const totalSkips = entries.filter((e) => e.entryType === "skip_signal").length;

    const approvalRate = totalApproved + totalEdits + totalSkips > 0
      ? ((totalApproved + totalEdits) / (totalApproved + totalEdits + totalSkips)) * 100
      : 0;

    return {
      totalEntries,
      approvalRate: Math.round(approvalRate),
      byType: {
        approved: totalApproved,
        edits: totalEdits,
        skips: totalSkips,
      },
      byPlatform,
      maturity: totalEntries < 10 ? "learning" : totalEntries < 30 ? "developing" : totalEntries < 60 ? "maturing" : "mature",
    };
  });

  // GET /api/voice-profile/recent — recent voice profile activity
  app.get("/api/voice-profile/recent", { onRequest: [app.authenticate] }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 50);

    const entries = await db
      .select({
        id: voiceProfileEntries.id,
        platform: voiceProfileEntries.platform,
        entryType: voiceProfileEntries.entryType,
        originalContent: voiceProfileEntries.originalContent,
        finalContent: voiceProfileEntries.finalContent,
        diffCategories: voiceProfileEntries.diffCategories,
        skipReason: voiceProfileEntries.skipReason,
        weight: voiceProfileEntries.weight,
        createdAt: voiceProfileEntries.createdAt,
      })
      .from(voiceProfileEntries)
      .where(eq(voiceProfileEntries.userId, request.userId))
      .orderBy(desc(voiceProfileEntries.createdAt))
      .limit(limit);

    return entries;
  });
}
