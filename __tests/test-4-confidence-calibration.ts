/**
 * TEST 4: Confidence Calibration — Few-Shot Score + Review-and-Regenerate Validation
 *
 * Tests the ACTUAL two-call pattern:
 * 1. Acting Agent drafts (few-shot)
 * 2. Scoring Agent evaluates (few-shot, separate call)
 * 3. If score < threshold, feed back → re-draft → re-score
 *
 * Generates 15 drafts across 3 quality tiers (by varying the system prompt),
 * runs the full draft → score → re-draft pipeline, then asks you to score.
 *
 * Validates:
 * - Do AI confidence scores correlate with human approval?
 * - Does the re-draft loop actually improve output?
 * - Are scorer feedback messages accurate and actionable?
 *
 * Pass threshold: Top-third confidence >70% human approval, bottom-third <40%
 * Secondary: Re-draft improves score in 50%+ of triggered cases
 *
 * No personal data needed. Uses simulated brain dumps. Run as-is.
 */

import "dotenv/config";
import { sonnet, SONNET_MODEL, saveResults, printHeader, printDivider } from "./shared";

// Voice profile (simulated — represents a professional, understated tech voice)
const VOICE_EXAMPLES = `[Approved Post 1]
Shipped CloudCorrect v2. 65 AWS checks across 12 services. MIT licensed. If your cloud bill surprises you, this is where to start.

[Approved Post 2]
A client processed 400 documents through DocProof in a single day. That's 3 days of manual work eliminated.

[Approved Post 3]
We build cloud infrastructure and AI tools. Not slide decks about them. Three new tools shipped this quarter, all open-source.

[Approved Post 4]
CloudCorrect now supports 12 AWS services. Added RDS, DynamoDB, and ElastiCache checks last week. Real checks, real savings.

[Approved Post 5]
The best proof we can build AI tools that work: a client ran 400 documents through DocProof without us knowing. Zero support tickets.`;

const AVOID_PATTERNS = [
  "Never open with 'Excited to share' or emotional openers",
  "Never use exclamation marks",
  "Never use hashtags",
  "Never use marketing language or buzzwords",
  "Avoid using emojis, em-dashes and other AI-ish patterns",
  "Always lead with the outcome or specific number",
];

// Three quality tiers of system prompts to generate varied-quality drafts
const PROMPT_TIERS = {
  good: `Draft a LinkedIn post. Match this voice exactly:
${VOICE_EXAMPLES}

Avoid: ${AVOID_PATTERNS.join(". ")}

Output ONLY the post text.`,

  mediocre: `Write a LinkedIn post about the topic. Keep it professional and informative.
Use a business-appropriate tone. Output ONLY the post text.`,

  bad: `Write an exciting LinkedIn post! Use enthusiasm, emojis where appropriate,
and marketing language. Make it engaging and shareable! Output ONLY the post text.`,
};

const SCORING_PROMPT = `You are the confidence scorer for ShipLoop.

VOICE PROFILE (approved posts):
${VOICE_EXAMPLES}

AVOID PATTERNS:
${AVOID_PATTERNS.map((p) => `- ${p}`).join("\n")}

Score the draft on a 0.0 to 1.0 scale:
- Voice match (40%): Same tone, vocabulary, structure as approved posts?
- Content quality (25%): Substantive with specifics, or generic?
- Angle fit (20%): Leads with proof/outcomes?
- Platform fit (15%): Formatted for LinkedIn?

OUTPUT (strict JSON only):
{"confidence_score": 0.85, "reasoning": "One sentence", "specific_issues": ["issue 1"]}`;

const REDRAFT_PROMPT = `You are the Acting Agent. Your draft was scored and needs improvement.

VOICE PROFILE:
${VOICE_EXAMPLES}

AVOID: ${AVOID_PATTERNS.join(". ")}`;

// Brain dumps to draft from
const BRAIN_DUMPS = [
  "Shipped CloudCorrect v3 with Lambda and Step Functions checks. 15 new checks total.",
  "Client migrated their entire document workflow to DocProof. Processing 2000 docs/day now.",
  "Spoke at the local AWS meetup about serverless cost optimization. Good turnout.",
  "Released Presentify beta. Multi-provider AI support — works with Claude, GPT, Gemini.",
  "Interesting debugging session — found a race condition in our event pipeline that was causing duplicate processing.",
];

async function draftContent(systemPrompt: string, brainDump: string): Promise<string> {
  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: `Brain dump: "${brainDump}"` }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function scoreContent(draft: string): Promise<{ confidence_score: number; reasoning: string; specific_issues: string[] }> {
  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1000,
    system: SCORING_PROMPT,
    messages: [{ role: "user", content: `Score this draft:\n\n${draft}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { confidence_score: 0.5, reasoning: "Parse failed", specific_issues: [] };
  }
}

async function redraft(originalDraft: string, scoreResult: { confidence_score: number; reasoning: string; specific_issues: string[] }, brainDump: string): Promise<string> {
  const prompt = `${REDRAFT_PROMPT}

YOUR PREVIOUS DRAFT:
${originalDraft}

FEEDBACK: Score ${scoreResult.confidence_score.toFixed(2)} — ${scoreResult.reasoning}
Issues: ${(scoreResult.specific_issues || []).join("; ")}

Rewrite addressing the issues. Brain dump: "${brainDump}"
Output ONLY the improved post text.`;

  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4000,
    system: prompt,
    messages: [{ role: "user", content: "Rewrite the draft." }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

const REVIEW_THRESHOLD = 0.75;

async function runTest() {
  printHeader("TEST 4: Confidence Calibration (Score + Review-and-Regenerate)");

  const allDrafts: Array<{
    id: number;
    brain_dump: string;
    tier: string;
    initial_draft: string;
    initial_score: number;
    initial_reasoning: string;
    initial_issues: string[];
    redrafted: boolean;
    final_draft: string;
    final_score: number;
    final_reasoning: string;
    improved: boolean | null;
  }> = [];

  let draftId = 0;

  // Generate 15 drafts: 5 per quality tier
  for (const [tier, prompt] of Object.entries(PROMPT_TIERS)) {
    for (let i = 0; i < BRAIN_DUMPS.length; i++) {
      draftId++;
      const dump = BRAIN_DUMPS[i];
      console.log(`  Draft ${draftId}/15 (${tier}): "${dump.slice(0, 50)}..."...`);

      // Step 1: Draft
      const initialDraft = await draftContent(prompt, dump);

      // Step 2: Score
      const initialScore = await scoreContent(initialDraft);

      // Step 3: Re-draft if below threshold
      let finalDraft = initialDraft;
      let finalScore = initialScore;
      let redrafted = false;
      let improved: boolean | null = null;

      if (initialScore.confidence_score < REVIEW_THRESHOLD) {
        console.log(`    Score ${initialScore.confidence_score.toFixed(2)} < ${REVIEW_THRESHOLD} → re-drafting...`);
        finalDraft = await redraft(initialDraft, initialScore, dump);
        finalScore = await scoreContent(finalDraft);
        redrafted = true;
        improved = finalScore.confidence_score > initialScore.confidence_score;
        console.log(`    Re-draft: ${initialScore.confidence_score.toFixed(2)} → ${finalScore.confidence_score.toFixed(2)} (${improved ? "improved" : "not improved"})`);
      } else {
        console.log(`    Score ${initialScore.confidence_score.toFixed(2)} ≥ ${REVIEW_THRESHOLD} → no re-draft needed`);
      }

      allDrafts.push({
        id: draftId,
        brain_dump: dump,
        tier,
        initial_draft: initialDraft,
        initial_score: initialScore.confidence_score,
        initial_reasoning: initialScore.reasoning,
        initial_issues: initialScore.specific_issues || [],
        redrafted,
        final_draft: finalDraft,
        final_score: finalScore.confidence_score,
        final_reasoning: finalScore.reasoning,
        improved,
      });
    }
  }

  // Sort by final score for tier analysis
  const sorted = [...allDrafts].sort((a, b) => b.final_score - a.final_score);
  const topThird = sorted.slice(0, 5);
  const bottomThird = sorted.slice(10, 15);
  const redraftCases = allDrafts.filter((d) => d.redrafted);
  const redraftImproved = redraftCases.filter((d) => d.improved);

  // Shuffle for unbiased human scoring
  const shuffled = [...allDrafts].sort(() => Math.random() - 0.5);

  printDivider();
  printHeader("ALL 15 DRAFTS — Score Each One");

  for (const d of shuffled) {
    printDivider();
    console.log(`DRAFT #${d.id} | Tier: ${d.tier} | AI Score: ${d.final_score.toFixed(2)}${d.redrafted ? ` (re-drafted from ${d.initial_score.toFixed(2)})` : ""}`);
    console.log(`AI says: ${d.final_reasoning}`);
    console.log();
    console.log(d.final_draft);
    console.log();
    console.log(`YOUR SCORE: [ A = approve / E = edit / S = skip ]`);
  }

  printDivider();
  printHeader("TIER ANALYSIS");
  console.log("TOP 5 by AI confidence (should be mostly A or E):");
  for (const d of topThird) {
    console.log(`  #${d.id} (${d.tier}): ${d.final_score.toFixed(2)}`);
  }
  console.log("\nBOTTOM 5 by AI confidence (should be mostly S):");
  for (const d of bottomThird) {
    console.log(`  #${d.id} (${d.tier}): ${d.final_score.toFixed(2)}`);
  }

  printDivider();
  printHeader("RE-DRAFT ANALYSIS");
  console.log(`Re-drafts triggered: ${redraftCases.length} / ${allDrafts.length}`);
  console.log(`Re-drafts that improved: ${redraftImproved.length} / ${redraftCases.length}`);
  if (redraftCases.length > 0) {
    console.log(`Improvement rate: ${((redraftImproved.length / redraftCases.length) * 100).toFixed(0)}% (threshold: 50%)`);
  }
  for (const d of redraftCases) {
    console.log(`  #${d.id} (${d.tier}): ${d.initial_score.toFixed(2)} → ${d.final_score.toFixed(2)} ${d.improved ? "IMPROVED" : "NOT IMPROVED"}`);
  }

  saveResults("test-4-confidence-calibration", {
    test: "Confidence Calibration (Score + Review-and-Regenerate)",
    pattern: "few-shot draft → few-shot score → review-and-regenerate if below threshold",
    model: SONNET_MODEL,
    review_threshold: REVIEW_THRESHOLD,
    total_drafts: allDrafts.length,
    drafts_per_tier: { good: 5, mediocre: 5, bad: 5 },
    redraft_stats: {
      triggered: redraftCases.length,
      improved: redraftImproved.length,
      improvement_rate: redraftCases.length > 0 ? redraftImproved.length / redraftCases.length : null,
    },
    top_third_ids: topThird.map((d) => d.id),
    bottom_third_ids: bottomThird.map((d) => d.id),
    all_drafts: allDrafts.map((d) => ({
      id: d.id,
      tier: d.tier,
      initial_score: d.initial_score,
      final_score: d.final_score,
      redrafted: d.redrafted,
      improved: d.improved,
      final_draft_preview: d.final_draft.slice(0, 100) + "...",
      human_score: `FILL_IN: A / E / S`,
    })),
    scoring: {
      top_third_approval_rate: "FILL_IN: X/5 rated A or E",
      bottom_third_skip_rate: "FILL_IN: X/5 rated S",
      false_positives: "FILL_IN: high AI score + you'd skip",
      false_negatives: "FILL_IN: low AI score + you'd approve",
      redraft_quality: "FILL_IN: Did re-drafts actually get better to your eyes?",
      scorer_feedback_accuracy: "FILL_IN: Were specific_issues accurate?",
      pass_calibration: "FILL_IN: true / false (top >70% approval, bottom <40%)",
      pass_redraft: "FILL_IN: true / false (50%+ improvement rate)",
      notes: "FILL_IN: Observations",
    },
  });
}

runTest().catch(console.error);
