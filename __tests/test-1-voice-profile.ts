/**
 * TEST 1: Voice Profile — Few-Shot + Review-and-Regenerate
 *
 * Tests the ACTUAL pattern: code assembles per-platform voice examples,
 * Acting Agent drafts (few-shot), Scoring Agent evaluates (few-shot),
 * if score is low → feedback + re-draft (up to 2 iterations).
 *
 * Validates:
 * - Few-shot prompt assembly from real posts
 * - Draft quality from assembled context
 * - Scoring accuracy (does it catch bad drafts?)
 * - Re-draft improvement (does feedback actually help?)
 *
 * Pass threshold: 3/5 final drafts approved or approved-with-minor-edit
 * Secondary: re-draft loop improves score in at least 50% of cases
 *
 * BEFORE RUNNING: Edit data/real-posts.json with your real posts and brain dumps.
 */

import "dotenv/config";
import { sonnet, SONNET_MODEL, loadJson, saveResults, printHeader, printDivider } from "./shared";

interface PostData {
  posts: Array<{ platform: string; content: string; engagement: Record<string, number> }>;
  brain_dumps_for_drafting: string[];
}

// Simulates the code-side prompt assembly that would happen in the real system
function assembleVoiceContext(posts: PostData["posts"], platform: string) {
  const platformPosts = posts.filter((p) => p.platform === platform);
  // In real system: query voice_profile_entries, apply recency weighting, take top 10
  // Here: use available posts as few-shot examples
  const examples = platformPosts.slice(0, 10);

  const positiveExamples = examples
    .map((p, i) => `[Approved Post ${i + 1}]\n${p.content}`)
    .join("\n\n");

  // Simulated skip signals (what to avoid)
  const avoidPatterns = [
    "Never open with 'Excited to share' or similar emotional openers",
    "Never use exclamation marks unless the examples consistently do",
    "Never add hashtags unless the examples consistently use them",
    "Never use marketing language or corporate tone",
  ];

  return { positiveExamples, avoidPatterns };
}

function buildDraftingPrompt(voiceExamples: string, avoidPatterns: string[], directives: string) {
  return `You are the Acting Agent for ShipLoop. Draft a LinkedIn post from the brain dump provided.

VOICE PROFILE (${voiceExamples.split("[Approved Post").length - 1} approved posts as few-shot examples):
${voiceExamples}

WHAT TO AVOID (learned from skipped drafts):
${avoidPatterns.map((p) => `- ${p}`).join("\n")}

CURRENT STRATEGIST DIRECTIVES:
${directives}

RULES:
- Match the tone, vocabulary, sentence structure, and rhythm of the approved posts
- Output ONLY the post text, nothing else
- Format for LinkedIn: short paragraphs, no markdown`;
}

function buildScoringPrompt(voiceExamples: string, avoidPatterns: string[]) {
  return `You are the confidence scorer for ShipLoop. You evaluate drafts against the voice profile.

VOICE PROFILE (approved posts as reference):
${voiceExamples}

KNOWN AVOID PATTERNS:
${avoidPatterns.map((p) => `- ${p}`).join("\n")}

SCORING CRITERIA (0.0 to 1.0):
- Voice match (40%): Does this sound like the same person who wrote the approved posts?
- Content quality (25%): Is this substantive with specific details, or generic?
- Angle fit (20%): Does it lead with proof/outcomes, not opinions?
- Platform fit (15%): Is it formatted correctly for LinkedIn?

OUTPUT (strict JSON, nothing else):
{"confidence_score": 0.85, "reasoning": "One sentence explaining the score", "specific_issues": ["issue 1", "issue 2"]}`;
}

function buildRedraftPrompt(
  voiceExamples: string,
  avoidPatterns: string[],
  originalDraft: string,
  score: number,
  reasoning: string,
  issues: string[]
) {
  return `You are the Acting Agent for ShipLoop. Your previous draft scored ${score.toFixed(2)} and needs improvement.

VOICE PROFILE:
${voiceExamples}

WHAT TO AVOID:
${avoidPatterns.map((p) => `- ${p}`).join("\n")}

YOUR PREVIOUS DRAFT:
${originalDraft}

SCORER FEEDBACK:
- Score: ${score.toFixed(2)}
- Reasoning: ${reasoning}
- Specific issues: ${issues.join("; ")}

Rewrite the draft addressing the specific issues. Output ONLY the improved post text, nothing else.`;
}

async function draft(systemPrompt: string, brainDump: string): Promise<string> {
  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: `Brain dump: "${brainDump}"` }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function score(systemPrompt: string, draftText: string): Promise<{ confidence_score: number; reasoning: string; specific_issues: string[] }> {
  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: `Score this LinkedIn draft:\n\n${draftText}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { confidence_score: 0.5, reasoning: "Parse failed", specific_issues: [] };
  }
}

const REVIEW_THRESHOLD = 0.75;
const MAX_ITERATIONS = 2;

async function runTest() {
  printHeader("TEST 1: Voice Profile (Few-Shot + Review-and-Regenerate)");

  const data = loadJson<PostData>("data/real-posts.json");

  if (data.posts[0].content.startsWith("REPLACE")) {
    console.error("ERROR: Replace sample data in data/real-posts.json with your real posts.");
    process.exit(1);
  }

  const { positiveExamples, avoidPatterns } = assembleVoiceContext(data.posts, "linkedin");
  const directives = "Prioritise proof-of-execution content. Lead with outcomes and specific numbers. Deprioritise thought leadership and generic insights.";

  const draftingPrompt = buildDraftingPrompt(positiveExamples, avoidPatterns, directives);
  const scoringPrompt = buildScoringPrompt(positiveExamples, avoidPatterns);

  const results: Array<{
    brain_dump: string;
    iterations: Array<{ draft: string; score: number; reasoning: string; issues: string[] }>;
    final_draft: string;
    final_score: number;
    improved_on_redraft: boolean | null;
  }> = [];

  for (let i = 0; i < data.brain_dumps_for_drafting.length; i++) {
    const dump = data.brain_dumps_for_drafting[i];
    if (dump.startsWith("REPLACE")) {
      console.error(`ERROR: Brain dump ${i + 1} is still a placeholder.`);
      process.exit(1);
    }

    printDivider();
    console.log(`BRAIN DUMP ${i + 1}: "${dump.slice(0, 80)}..."\n`);

    const iterations: Array<{ draft: string; score: number; reasoning: string; issues: string[] }> = [];

    // Iteration 1: Initial draft + score
    console.log("  Iteration 1: Drafting...");
    let currentDraft = await draft(draftingPrompt, dump);
    console.log("  Iteration 1: Scoring...");
    let currentScore = await score(scoringPrompt, currentDraft);
    iterations.push({
      draft: currentDraft,
      score: currentScore.confidence_score,
      reasoning: currentScore.reasoning,
      issues: currentScore.specific_issues || [],
    });
    console.log(`  Score: ${currentScore.confidence_score.toFixed(2)} — ${currentScore.reasoning}`);

    // Review-and-regenerate loop
    let iteration = 1;
    while (currentScore.confidence_score < REVIEW_THRESHOLD && iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`\n  Iteration ${iteration}: Re-drafting (score was below ${REVIEW_THRESHOLD})...`);

      const redraftPrompt = buildRedraftPrompt(
        positiveExamples,
        avoidPatterns,
        currentDraft,
        currentScore.confidence_score,
        currentScore.reasoning,
        currentScore.specific_issues || []
      );
      currentDraft = await draft(redraftPrompt, dump);

      console.log(`  Iteration ${iteration}: Re-scoring...`);
      currentScore = await score(scoringPrompt, currentDraft);
      iterations.push({
        draft: currentDraft,
        score: currentScore.confidence_score,
        reasoning: currentScore.reasoning,
        issues: currentScore.specific_issues || [],
      });
      console.log(`  Score: ${currentScore.confidence_score.toFixed(2)} — ${currentScore.reasoning}`);
    }

    const improved = iterations.length > 1
      ? iterations[iterations.length - 1].score > iterations[0].score
      : null;

    console.log(`\n  FINAL DRAFT (after ${iterations.length} iteration${iterations.length > 1 ? "s" : ""}):`);
    console.log(`  ${currentDraft.slice(0, 200)}...`);
    if (improved !== null) {
      console.log(`  Re-draft ${improved ? "IMPROVED" : "DID NOT IMPROVE"} score: ${iterations[0].score.toFixed(2)} → ${iterations[iterations.length - 1].score.toFixed(2)}`);
    }

    results.push({
      brain_dump: dump,
      iterations,
      final_draft: currentDraft,
      final_score: currentScore.confidence_score,
      improved_on_redraft: improved,
    });
  }

  printDivider();
  printHeader("SCORING TIME — Your Turn");
  console.log("For each of the 5 FINAL drafts, score honestly:\n");
  console.log("  A = Would approve as-is (sounds like me)");
  console.log("  E = Would approve with minor edit (close but needs tweaking)");
  console.log("  S = Would skip (doesn't sound like me / wrong angle / too generic)\n");
  console.log("ALSO evaluate the re-draft loop:");
  console.log("  - When re-drafting happened, did the output actually improve?");
  console.log("  - Were the scorer's 'specific_issues' accurate?");
  console.log("  - Did the re-draft address the right things?\n");
  console.log("Pass thresholds:");
  console.log("  Primary: 3/5 final drafts rated A or E");
  console.log("  Secondary: re-draft improved output in 50%+ of cases where it triggered\n");

  const redraftCases = results.filter((r) => r.improved_on_redraft !== null);

  saveResults("test-1-voice-profile", {
    test: "Voice Profile (Few-Shot + Review-and-Regenerate)",
    pattern: "few-shot → score → review-and-regenerate loop (max 2 iterations)",
    model: SONNET_MODEL,
    few_shot_count: data.posts.filter((p) => p.platform === "linkedin").slice(0, 10).length,
    review_threshold: REVIEW_THRESHOLD,
    max_iterations: MAX_ITERATIONS,
    results: results.map((r, i) => ({
      brain_dump: r.brain_dump,
      iteration_count: r.iterations.length,
      score_progression: r.iterations.map((it) => it.score),
      improved_on_redraft: r.improved_on_redraft,
      final_draft: r.final_draft,
      final_score: r.final_score,
      human_score: `FILL_IN: A / E / S for draft ${i + 1}`,
    })),
    summary: {
      total_drafts: results.length,
      drafts_needing_redraft: redraftCases.length,
      redrafts_that_improved: redraftCases.filter((r) => r.improved_on_redraft).length,
    },
    scoring: {
      drafts_approved: "FILL_IN: count of A + E",
      pass_primary: "FILL_IN: true / false (3/5 A or E)",
      redraft_improvement_rate: "FILL_IN: X/Y cases improved",
      pass_secondary: "FILL_IN: true / false (50%+ improved)",
      scorer_accuracy: "FILL_IN: Were the specific_issues generally accurate?",
      notes: "FILL_IN: What worked? What didn't?",
    },
  });
}

runTest().catch(console.error);
