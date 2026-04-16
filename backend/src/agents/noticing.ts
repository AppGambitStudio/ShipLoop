import { z } from "zod";
import { callAiJson } from "./retry.js";
import { buildNoticingPrompt } from "./prompts/noticing-system.js";

const OpportunitySchema = z.object({
  description: z.string(),
  angle: z.string(),
  urgency: z.enum(["high", "medium", "low"]),
  relevanceScore: z.number().min(0).max(1),
  assetName: z.string().nullable(),
  suggestedChannels: z.array(z.string()),
});

const NoticingOutputSchema = z.object({
  opportunities: z.array(OpportunitySchema),
  emotional_state: z.enum(["neutral", "stressed", "excited"]),
});

export type NoticingOutput = z.infer<typeof NoticingOutputSchema>;

interface NoticingInput {
  rawText: string;
  companyType: string;
  assets: Array<{ name: string; oneLiner: string; category: string; targetAudience: string }>;
  directives: Record<string, unknown> | null;
}

export async function runNoticingAgent(input: NoticingInput): Promise<NoticingOutput> {
  const systemPrompt = buildNoticingPrompt({
    companyType: input.companyType,
    assets: input.assets,
    directives: input.directives,
  });

  return callAiJson({
    system: systemPrompt,
    userMessage: `Analyze this brain dump and extract distribution opportunities:\n\n${input.rawText}`,
    schema: NoticingOutputSchema,
    maxRetries: 2,
  });
}
