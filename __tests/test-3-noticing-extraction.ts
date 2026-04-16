/**
 * TEST 3: Noticing Extraction — Zero-Shot Single Call
 *
 * Tests the ACTUAL pattern: code assembles context (asset registry + directives),
 * Sonnet extracts opportunities in a single zero-shot call.
 * Validates against human ground truth.
 *
 * This IS a single-call test because Noticing is stateless by design.
 * The complexity is in the prompt assembly, not in agent iteration.
 *
 * Validates:
 * - Extraction precision (did it extract junk?)
 * - Extraction recall (did it miss real opportunities?)
 * - Angle classification accuracy
 * - Emotional state detection
 * - Process-as-content recognition (for indie builder scenarios)
 * - Noise filtering (ignoring irrelevant items)
 *
 * Pass threshold: 80%+ precision, 70%+ recall across all dumps
 * Secondary: Emotional state accuracy > 70%
 *
 * BEFORE RUNNING: Edit data/real-brain-dumps.json with real brain dumps and ground truth.
 */

import "dotenv/config";
import { sonnet, SONNET_MODEL, loadJson, saveResults, printHeader, printDivider } from "./shared";

interface BrainDumpData {
  dumps: Array<{
    raw_text: string;
    ground_truth_opportunities: Array<{
      description: string;
      angle: string;
      channels: string[];
      urgency: string;
    }>;
    ground_truth_emotional_state: string;
  }>;
}

interface ExtractedOpportunity {
  description: string;
  angle: string;
  suggested_channels: string[];
  urgency: string;
  relevance_score: number;
}

interface NoticingOutput {
  opportunities: ExtractedOpportunity[];
  emotional_state: string;
}

// Simulates the code-side context assembly that happens before the LLM call
function assembleNoticingContext(companyType: string) {
  // Asset registry (would come from Postgres in production)
  const assetRegistry = [
    { id: "asset-1", name: "CloudCorrect", one_liner: "Open-source AWS audit tool", category: "open_source" },
    { id: "asset-2", name: "DocProof", one_liner: "AI document verification for enterprise", category: "product" },
    { id: "asset-3", name: "Presentify", one_liner: "Multi-provider AI presentation generator", category: "product" },
    { id: "asset-4", name: "IPOIQ", one_liner: "IPO intelligence and analysis platform", category: "product" },
  ];

  // Current Strategist directives (would come from strategist_memory table)
  const directives: Record<string, unknown> = {
    channelWeights: { linkedin: 0.6, reddit: 0.25, twitter: 0.15 },
    contentAngleDefaults: ["proof-of-execution", "client-outcome", "technical-deep-dive"],
    priorityAssetIds: ["asset-1", "asset-2"],
    silenceAlarm: false,
  };

  // Adjust for company type
  if (companyType === "indie_builder") {
    directives.contentAngleDefaults = [
      "building-in-public", "debugging-story", "milestone-update",
      "decision-transparency", "setback-reflection",
    ];
    directives.channelWeights = { twitter: 0.4, hackernews: 0.25, indiehackers: 0.2, reddit: 0.15 };
  }

  return { assetRegistry, directives };
}

function buildNoticingPrompt(
  assetRegistry: Array<Record<string, unknown>>,
  directives: Record<string, unknown>,
  companyType: string
) {
  const processAsContentSection = companyType === "indie_builder"
    ? `\nPROCESS-AS-CONTENT: This is an indie builder. The process of building IS content.
Debugging stories, technical decisions, metrics, setbacks, and learnings are FIRST-CLASS distribution material.
"Spent 4 hours on Stripe webhooks" is a high-urgency opportunity, not noise.\n`
    : `\nPROCESS-AS-CONTENT: This is a ${companyType}. Process content (debugging stories, internal decisions) is LOW priority unless it demonstrates expertise to the target audience.\n`;

  return `You are the Noticing Agent for ShipLoop. Extract distribution opportunities from the brain dump.

COMPANY TYPE: ${companyType}

ASSET REGISTRY:
${JSON.stringify(assetRegistry, null, 2)}

CURRENT STRATEGIST DIRECTIVES:
${JSON.stringify(directives, null, 2)}
${processAsContentSection}
EXTRACTION RULES:
- Extract ONLY genuine distribution opportunities
- Ignore personal items, internal ops, and noise
- Match opportunities to existing assets when possible (use asset IDs)
- Detect emotional state: neutral, stressed, or excited (tone-based)
- If the brain dump has no distribution-relevant content, return empty array

AVAILABLE ANGLES:
proof-of-execution, client-outcome, feature-launch, technical-deep-dive,
milestone-update, building-in-public, debugging-story, decision-transparency,
setback-reflection, learning-from-failure, philosophy, community-engagement

OUTPUT (strict JSON, nothing else):
{
  "opportunities": [
    {
      "description": "What happened",
      "asset_id": "asset-1 or null",
      "angle": "angle-name",
      "suggested_channels": ["linkedin", "reddit:r/subreddit"],
      "urgency": "high|medium|low",
      "relevance_score": 0.85
    }
  ],
  "emotional_state": "neutral|stressed|excited"
}`;
}

async function extract(systemPrompt: string, brainDump: string): Promise<NoticingOutput> {
  const response = await sonnet.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: brainDump }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { opportunities: [], emotional_state: "neutral" };
  }
}

function calculateMatch(
  extracted: ExtractedOpportunity[],
  groundTruth: Array<{ description: string; angle: string; channels: string[]; urgency: string }>
): { matches: number; details: string[] } {
  const details: string[] = [];
  let matches = 0;

  for (const ex of extracted) {
    const match = groundTruth.find((gt) => {
      // Match on description overlap OR angle match
      const descWords = gt.description.toLowerCase().split(/\s+/);
      const descOverlap = descWords.filter((w) => w.length > 3 && ex.description.toLowerCase().includes(w)).length;
      return descOverlap >= 2 || gt.angle === ex.angle;
    });

    if (match) {
      matches++;
      const angleCorrect = match.angle === ex.angle;
      details.push(`  MATCH: "${ex.description.slice(0, 50)}..." → angle ${angleCorrect ? "CORRECT" : `WRONG (expected: ${match.angle}, got: ${ex.angle})`}`);
    } else {
      details.push(`  EXTRA: "${ex.description.slice(0, 50)}..." (${ex.angle}) — not in ground truth`);
    }
  }

  for (const gt of groundTruth) {
    const found = extracted.some((ex) => {
      const descWords = gt.description.toLowerCase().split(/\s+/);
      const descOverlap = descWords.filter((w) => w.length > 3 && ex.description.toLowerCase().includes(w)).length;
      return descOverlap >= 2 || gt.angle === ex.angle;
    });
    if (!found) {
      details.push(`  MISSED: "${gt.description.slice(0, 50)}..." (${gt.angle})`);
    }
  }

  return { matches, details };
}

async function runTest() {
  printHeader("TEST 3: Noticing Extraction (Zero-Shot Single Call)");

  const data = loadJson<BrainDumpData>("data/real-brain-dumps.json");

  if (data.dumps[0].raw_text.startsWith("REPLACE")) {
    console.error("ERROR: Replace sample data in data/real-brain-dumps.json with real brain dumps + ground truth.");
    process.exit(1);
  }

  // Test with service_company context (most brain dumps) + one indie_builder run
  const companyType = "service_company";
  const { assetRegistry, directives } = assembleNoticingContext(companyType);
  const systemPrompt = buildNoticingPrompt(assetRegistry, directives, companyType);

  const results: Array<{
    dump_index: number;
    brain_dump: string;
    ground_truth: { opportunities: number; emotional_state: string };
    extracted: NoticingOutput;
    precision: number;
    recall: number;
    emotional_correct: boolean;
    match_details: string[];
  }> = [];

  let totalPrecision = 0;
  let totalRecall = 0;
  let emotionalCorrect = 0;

  for (let i = 0; i < data.dumps.length; i++) {
    const dump = data.dumps[i];
    console.log(`Processing dump ${i + 1}/${data.dumps.length}...`);

    const extracted = await extract(systemPrompt, dump.raw_text);

    const gtCount = dump.ground_truth_opportunities.length;
    const exCount = extracted.opportunities.length;
    const { matches, details } = calculateMatch(extracted.opportunities, dump.ground_truth_opportunities);

    const precision = exCount === 0 ? (gtCount === 0 ? 1.0 : 0.0) : matches / exCount;
    const recall = gtCount === 0 ? (exCount === 0 ? 1.0 : 0.0) : Math.min(matches, gtCount) / gtCount;
    const emotionalMatch = extracted.emotional_state === dump.ground_truth_emotional_state;

    totalPrecision += precision;
    totalRecall += recall;
    if (emotionalMatch) emotionalCorrect++;

    results.push({
      dump_index: i + 1,
      brain_dump: dump.raw_text,
      ground_truth: { opportunities: gtCount, emotional_state: dump.ground_truth_emotional_state },
      extracted,
      precision,
      recall,
      emotional_correct: emotionalMatch,
      match_details: details,
    });

    printDivider();
    console.log(`DUMP ${i + 1}: "${dump.raw_text.slice(0, 80)}..."`);
    console.log(`  Expected: ${gtCount} opportunities (${dump.ground_truth_emotional_state})`);
    console.log(`  Got:      ${exCount} opportunities (${extracted.emotional_state})`);
    console.log(`  Precision: ${(precision * 100).toFixed(0)}% | Recall: ${(recall * 100).toFixed(0)}% | Emotional: ${emotionalMatch ? "OK" : "WRONG"}`);
    for (const d of details) console.log(d);
  }

  const avgPrecision = totalPrecision / data.dumps.length;
  const avgRecall = totalRecall / data.dumps.length;
  const emotionalAccuracy = emotionalCorrect / data.dumps.length;

  printDivider();
  printHeader("RESULTS");
  console.log(`  Precision:       ${(avgPrecision * 100).toFixed(1)}% (threshold: 80%) — ${avgPrecision >= 0.8 ? "PASS" : "FAIL"}`);
  console.log(`  Recall:          ${(avgRecall * 100).toFixed(1)}% (threshold: 70%) — ${avgRecall >= 0.7 ? "PASS" : "FAIL"}`);
  console.log(`  Emotional State: ${(emotionalAccuracy * 100).toFixed(1)}% (threshold: 70%) — ${emotionalAccuracy >= 0.7 ? "PASS" : "FAIL"}`);
  console.log(`\n  Overall: ${avgPrecision >= 0.8 && avgRecall >= 0.7 ? "PASS" : "FAIL"}`);

  saveResults("test-3-noticing-extraction", {
    test: "Noticing Extraction (Zero-Shot Single Call)",
    pattern: "zero-shot with assembled context (asset registry + directives)",
    model: SONNET_MODEL,
    company_type: companyType,
    avg_precision: avgPrecision,
    avg_recall: avgRecall,
    emotional_accuracy: emotionalAccuracy,
    pass_precision: avgPrecision >= 0.8,
    pass_recall: avgRecall >= 0.7,
    pass_overall: avgPrecision >= 0.8 && avgRecall >= 0.7,
    per_dump: results,
    scoring: {
      angle_accuracy_notes: "FILL_IN: Were angles generally correct?",
      channel_accuracy_notes: "FILL_IN: Were channel suggestions appropriate?",
      noise_handling_notes: "FILL_IN: Did it correctly ignore irrelevant items?",
      asset_matching_notes: "FILL_IN: Did it correctly link to existing assets?",
      notes: "FILL_IN: Overall observations",
    },
  });
}

runTest().catch(console.error);
