import { z } from "zod";
import { openrouter, SONNET_MODEL } from "./openrouter.js";
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
  directives: string[];
}

export async function runNoticingAgent(input: NoticingInput): Promise<NoticingOutput> {
  const systemPrompt = buildNoticingPrompt({
    companyType: input.companyType,
    assets: input.assets,
    directives: input.directives,
  });

  const response = await openrouter.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze this brain dump and extract distribution opportunities:\n\n${input.rawText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Noticing Agent");
  }

  // Strip markdown code fences if present
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonText);
  return NoticingOutputSchema.parse(parsed);
}
