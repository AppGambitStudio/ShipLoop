import { z } from "zod";
import { callAi, callAiJson } from "./retry.js";
import { buildActingPrompt, buildScoringPrompt } from "./prompts/acting-system.js";

const ScoringOutputSchema = z.object({
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  specific_issues: z.array(z.string()).optional().default([]),
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
  directives: Record<string, unknown> | null;
}

export async function runActingAgent(input: ActingInput): Promise<ActingResult> {
  // Step 1: Draft the content (plain text, not JSON)
  const draftPrompt = buildActingPrompt(input.platform, input.voiceContext, input.directives);
  const content = await callAi({
    system: draftPrompt,
    userMessage: `Draft a ${input.platform} post for this opportunity:\n\nOpportunity: ${input.opportunityDescription}\nAngle: ${input.angle}\nTarget: ${input.target}`,
    maxTokens: 2048,
  });

  // Step 2: Score the draft (JSON with retry)
  const scorePrompt = buildScoringPrompt(input.voiceContext);
  const scoring = await callAiJson({
    system: scorePrompt,
    userMessage: `Score this ${input.platform} draft:\n\n${content}`,
    schema: ScoringOutputSchema,
    maxTokens: 512,
    maxRetries: 2,
  });

  return {
    platform: input.platform,
    target: input.target,
    content,
    confidenceScore: scoring.confidenceScore,
    reasoning: scoring.reasoning,
  };
}
