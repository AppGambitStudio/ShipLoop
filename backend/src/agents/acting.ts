import { z } from "zod";
import { openrouter, SONNET_MODEL } from "./openrouter.js";
import { buildActingPrompt, buildScoringPrompt } from "./prompts/acting-system.js";

const ScoringOutputSchema = z.object({
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  specific_issues: z.array(z.string()),
});

export interface ActingResult {
  platform: string;
  target: string;
  content: string;
  confidenceScore: number;
  reasoning: string;
}

interface ActingInput {
  opportunityDescription: string;
  angle: string;
  platform: string;
  target: string;
  voiceContext: string;
  directives: string[];
}

export async function runActingAgent(input: ActingInput): Promise<ActingResult> {
  // Step 1: Draft the content
  const draftPrompt = buildActingPrompt(input.platform, input.voiceContext, input.directives);

  const draftResponse = await openrouter.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2048,
    system: draftPrompt,
    messages: [
      {
        role: "user",
        content: `Draft a ${input.platform} post for this opportunity:\n\nOpportunity: ${input.opportunityDescription}\nAngle: ${input.angle}\nTarget: ${input.target}`,
      },
    ],
  });

  const draftBlock = draftResponse.content.find((b) => b.type === "text");
  if (!draftBlock || draftBlock.type !== "text") {
    throw new Error("No text response from Acting Agent (draft)");
  }
  const content = draftBlock.text.trim();

  // Step 2: Score the draft (separate call)
  const scorePrompt = buildScoringPrompt(input.voiceContext);

  const scoreResponse = await openrouter.messages.create({
    model: SONNET_MODEL,
    max_tokens: 512,
    system: scorePrompt,
    messages: [
      {
        role: "user",
        content: `Score this ${input.platform} draft:\n\n${content}`,
      },
    ],
  });

  const scoreBlock = scoreResponse.content.find((b) => b.type === "text");
  if (!scoreBlock || scoreBlock.type !== "text") {
    throw new Error("No text response from Acting Agent (scoring)");
  }

  let scoreJson = scoreBlock.text.trim();
  if (scoreJson.startsWith("```")) {
    scoreJson = scoreJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const scoring = ScoringOutputSchema.parse(JSON.parse(scoreJson));

  return {
    platform: input.platform,
    target: input.target,
    content,
    confidenceScore: scoring.confidenceScore,
    reasoning: scoring.reasoning,
  };
}
