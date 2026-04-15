import { db } from "../db/client.js";
import { voiceProfileEntries } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

export async function getVoiceContext(userId: string, platform: string): Promise<string> {
  const entries = await db
    .select()
    .from(voiceProfileEntries)
    .where(
      and(
        eq(voiceProfileEntries.userId, userId),
        eq(voiceProfileEntries.platform, platform as any)
      )
    )
    .orderBy(desc(voiceProfileEntries.createdAt))
    .limit(20);

  if (entries.length === 0) {
    return "";
  }

  const now = Date.now();
  const sections: string[] = [];

  // Apply recency weighting: 0.95^weeks decay
  const weighted = entries.map((e) => {
    const weeksAgo = (now - new Date(e.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000);
    const decayFactor = Math.pow(0.95, weeksAgo);
    const effectiveWeight = e.weight * decayFactor;
    return { ...e, effectiveWeight };
  });

  // Sort by effective weight descending
  weighted.sort((a, b) => b.effectiveWeight - a.effectiveWeight);

  // Approved posts — the user's voice
  const approved = weighted.filter((e) => e.entryType === "approved_post");
  if (approved.length > 0) {
    sections.push("## Approved Posts (this is how the user writes)");
    for (const a of approved.slice(0, 5)) {
      sections.push(`[weight: ${a.effectiveWeight.toFixed(2)}]\n${a.finalContent || ""}\n`);
    }
  }

  // Edit patterns — what the user changes
  const edits = weighted.filter((e) => e.entryType === "edit_diff");
  if (edits.length > 0) {
    sections.push("## Edit Patterns (what the user changes in drafts)");
    for (const e of edits.slice(0, 5)) {
      sections.push(
        `[weight: ${e.effectiveWeight.toFixed(2)}]\nOriginal: ${e.originalContent || ""}\nEdited to: ${e.finalContent || ""}\n`
      );
    }
  }

  // Skip signals — what the user rejects
  const skips = weighted.filter((e) => e.entryType === "skip_signal");
  if (skips.length > 0) {
    sections.push("## Skip Patterns (what the user rejects)");
    for (const s of skips.slice(0, 5)) {
      sections.push(
        `[weight: ${s.effectiveWeight.toFixed(2)}] Skipped (${s.skipReason || "unknown"}): ${s.originalContent || ""}\n`
      );
    }
  }

  return sections.join("\n");
}
