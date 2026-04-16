/**
 * Edit Diff Analysis — Zero-shot single call
 *
 * Categorizes what the user changed when editing a draft.
 * This is the strongest voice learning signal (weight 2.0).
 */
import { z } from "zod";
import { callAiJson } from "./retry.js";

const DiffCategoriesSchema = z.object({
  tone_change: z.boolean().describe("Did the user change the emotional tone?"),
  structure_change: z.boolean().describe("Did the user restructure paragraphs, reorder, or reformat?"),
  content_addition: z.boolean().describe("Did the user add new information not in the original?"),
  content_removal: z.boolean().describe("Did the user remove content from the original?"),
  length_change: z.enum(["shorter", "longer", "same"]).describe("Did the final version get shorter or longer?"),
  summary: z.string().describe("One sentence describing the most important change"),
});

export type DiffCategories = z.infer<typeof DiffCategoriesSchema>;

export async function analyzeDiff(
  originalContent: string,
  editedContent: string
): Promise<DiffCategories> {
  return callAiJson({
    system: `You analyze edits made to AI-generated content drafts. Your job is to categorize WHAT changed between the original draft and the user's edited version.

This analysis trains a voice profile — the categories help the engine learn whether the user typically changes tone, structure, length, adds details, or removes fluff.

Output strict JSON matching the schema. No explanation.`,
    userMessage: `ORIGINAL DRAFT:
${originalContent}

USER'S EDITED VERSION:
${editedContent}

Categorize the changes.`,
    schema: DiffCategoriesSchema,
    maxTokens: 300,
    maxRetries: 1,
  });
}
