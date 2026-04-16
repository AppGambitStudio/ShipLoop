# SHIPLOOP — AI Touchpoint Patterns and Mapping

Spec Section 07

---

## 1. Pattern Taxonomy

Every AI touchpoint in ShipLoop falls into one of these patterns:

| Pattern | Description | Retry Strategy |
|---|---|---|
| **Zero-shot single call** | Fixed system prompt + assembled context. No examples needed. One LLM call. | 1 retry on parse failure. Falls back gracefully. |
| **Few-shot single call** | System prompt + dynamically assembled examples from voice profile or history. One LLM call. | 1 retry on parse failure. |
| **Review-and-regenerate** | Draft → score → if low, feed back score + reasoning → re-draft. Loop up to N times. | Max 2 iterations. If still below threshold, hold for Strategist. |
| **Multi-step agent with tools** | Long-running agent session with custom tools for reading/writing data. Multiple reasoning steps. | Built into Step Functions retry. Degraded mode if agent fails. |
| **Tool-using agent** | Agent with browser/API tools that interacts with external systems. | 2 retries with different approaches. Falls back to manual. |
| **External API** | Non-LLM API call (Whisper, platform APIs). | 1 retry. Graceful fallback. |

---

## 2. Complete Touchpoint Mapping

### Noticing Agent

| Touchpoint | Pattern | Shots | Input Assembly | Output | Validation | Retry |
|---|---|---|---|---|---|---|
| Extraction | Zero-shot single call | Zero-shot | Code assembles: raw text + asset registry + current directives | JSON array of opportunities | Zod schema validation | 1 retry on parse failure. No quality retry — human catches via approval queue. |
| Emotional state | Part of extraction call | Zero-shot | Included in extraction prompt | Enum: neutral / stressed / excited | Enum validation | Falls back to "neutral" if invalid |

### Acting Agent

| Touchpoint | Pattern | Shots | Input Assembly | Output | Validation | Retry |
|---|---|---|---|---|---|---|
| Drafting | Few-shot single call | Few-shot (top 10 weighted voice_profile_entries for this platform) | Code assembles: opportunity + per-platform voice examples + directives + "what to avoid" from recent skips | Platform-structured draft text | Zod schema. Platform format checks (character limits, structure). | 1 retry on parse failure. No content quality retry — scoring call handles that. |
| Scoring | Few-shot single call | Few-shot (same voice examples as reference) | Code assembles: the draft + voice profile examples + scoring rubric | Float 0-1 + reasoning string | Range validation (0-1) | Falls back to 0.5 (medium confidence) if fails. Draft still enters queue. |
| Re-draft on low score | Review-and-regenerate loop | Few-shot | If score < review threshold: original draft + score + reasoning + "improve based on this feedback" | Improved draft | Same as drafting. Score again after re-draft. | Max 2 iterations. If still below threshold, hold for Strategist review. |
| Edit diff analysis | Zero-shot single call | Zero-shot | Code assembles: original draft + approved/edited version | JSON: diff categories (tone, structure, content_addition, content_removal, length) | Zod schema | 1 retry on parse failure. Not critical path — can fail silently and log. |

### Reviewing Agent

| Touchpoint | Pattern | Shots | Input Assembly | Output | Validation | Retry |
|---|---|---|---|---|---|---|
| Signal parsing | Zero-shot single call (per platform) | Zero-shot | Code assembles: raw scraped/reported metrics + platform-specific parsing instructions | Structured signal records | Schema validation | 1 retry. Falls back to raw metric storage if parsing fails. |
| Weekly summary | Few-shot single call | Few-shot (last 2 weekly summaries as format examples) | Code assembles: structured signals + assets + directives + previous summary | Text matching summary template | Template structure check | 1 retry. Strategist can run with raw data if summary fails. |

### Strategist Agent

| Touchpoint | Pattern | Shots | Input Assembly | Output | Validation | Retry |
|---|---|---|---|---|---|---|
| Weekly run | Multi-step agent with tools | Few-shot (last 2 monologues for continuity) | Agent reads via custom tools: read_assets, read_posts, read_monologue, read_config, read_approvals | Agent writes via custom tools: write_directives, write_monologue, write_priorities | Each tool call validates schema on write | Step Functions retry with backoff. If fails, last week's directives continue (degraded). |
| Quarterly run | Multi-step agent with tools (same agent, different trigger) | Few-shot (last 4 monologues) | Same tools, reads 90 days instead of 30. Trigger prompt includes quarterly review instructions. | Same tools + must produce drift_score + optionally path_simulation | Same + drift_score range validation | Same retry. If quarterly fails, runs as weekly (partial > nothing). |

### Support Touchpoints

| Touchpoint | Pattern | Shots | Input Assembly | Output | Validation | Retry |
|---|---|---|---|---|---|---|
| Emotional fast-check | Zero-shot single call | Zero-shot | Code assembles: emotional flag + current directives + recent context | JSON: hold/adjust decision + reasoning | Schema validation | Not retried. Advisory only. Weekly Strategist handles if this fails. |
| Whisper transcription | External API | N/A | Audio file → Whisper API | Text transcript | Non-empty text | 1 retry. If fails, user prompted to type brain dump. |
| Browser signal scrape (v1.5) | Tool-using agent (MCP browser) | Zero-shot | Post URL + platform type → browser visits URL → extracts visible metrics | Structured metrics matching platform schema | Schema validation | 2 retries with different selectors. Falls back to manual metric reporting. |

---

## 3. Summary by Pattern

| Pattern | Touchpoints | Count |
|---|---|---|
| Zero-shot single call | Noticing extraction, emotional state, edit diff analysis, signal parsing, emotional fast-check | 5 |
| Few-shot single call | Acting drafting, Acting scoring, weekly summary | 3 |
| Review-and-regenerate | Acting re-draft on low score | 1 |
| Multi-step agent with tools | Strategist weekly, Strategist quarterly | 2 |
| Tool-using agent | Browser signal scrape (v1.5) | 1 |
| External API | Whisper transcription | 1 |

**Total: 13 AI touchpoints across 6 patterns.**

---

## 4. Prompt Assembly Complexity

The LLM call itself is often simple. The engineering complexity is in **what happens before the call** — assembling the right context.

| Touchpoint | Assembly Complexity | Why |
|---|---|---|
| Noticing extraction | Medium | Must query asset registry + latest directives. Directives change weekly. |
| Acting drafting | **High** | Must query voice_profile_entries filtered by platform, apply recency weighting, select top 10, format as few-shot examples, include "what to avoid" from recent skips, include current directives. This is a multi-query prompt construction pipeline. |
| Acting scoring | Medium | Same voice profile query as drafting, but formatted as evaluation criteria instead of examples. |
| Acting re-draft | Medium | Must include original draft + score + reasoning + feedback prompt. |
| Edit diff analysis | Low | Just two texts (original + edited). |
| Signal parsing | Low | Raw metrics + platform-specific template. |
| Weekly summary | Medium | Must aggregate structured signals + pull assets + directives + previous summary. |
| Strategist | **Handled by agent** | The agent reads data via tools — no code-side assembly needed. The tools return the data, the agent assembles its own context. |

---

## 5. Failure Modes and Graceful Degradation

The system is designed so that no single AI failure stops the engine:

| Component fails | What happens | Human impact |
|---|---|---|
| Noticing extraction | Brain dump saved, retry via SQS. After 3 failures: flagged in weekly summary. | Brain dump not processed. No drafts that day. |
| Acting drafting | Opportunity still exists. Retry. After 3 failures: Strategist reviews. | Fewer drafts in queue than expected. |
| Acting scoring | Falls back to 0.5 confidence. Draft enters queue as "needs your eye." | All drafts shown as medium confidence. Human reviews everything. |
| Acting re-draft loop | After 2 failed iterations, held for Strategist. | Low-confidence draft doesn't appear in queue. No user impact. |
| Edit diff analysis | Fails silently, logged. Voice profile misses one learning signal. | None visible. Slight delay in voice profile improvement. |
| Signal parsing | Falls back to raw metric storage. Strategist reads raw data. | Weekly summary less polished but still functional. |
| Weekly summary | Strategist runs with raw data instead. | No weekly summary message. Strategist still updates. |
| Strategist (weekly) | Last week's directives continue. Flagged in next summary. | Engine runs on stale directives. Degraded but functional. |
| Strategist (quarterly) | Falls back to weekly run. No drift score. | Quarterly review missed. Next quarter catches it. |
| Whisper | User prompted to type. | Voice input unavailable. Text input still works. |
| Browser scrape | Falls back to manual metric reporting. | User manually reports engagement. |

**Design principle:** Every failure degrades gracefully. The engine never stops entirely. The human is only notified when their action is needed (posting failed, voice input failed). Background failures are logged and surfaced in the weekly summary.
