# SHIPLOOP — Supplementary Simulations

Spec Section 04B — Gaps Found During Spec Expansion

These simulations cover scenarios not addressed in the original 9 simulations (A1-C3). They stress-test the voice profile learning loop, system degradation, messy input, and human behaviour patterns.

---

## SIMULATION D: VOICE PROFILE LEARNING CURVE (Cross-Type)

This is the core value loop. If this doesn't work, nothing else matters.

### D1. Week 1 — Cold Start (All Company Types)

**Setup:** Engine is new. No approved posts. No voice profile. No signal history. Strategist has only the onboarding config (company type, goal statement, channels).

**Brain dump:** "Shipped CloudCorrect v2. 65 AWS checks across 12 services. MIT licensed."

**Noticing:** Extracts correctly — CloudCorrect launch, 3 opportunities. No issues here. Noticing is stateless and doesn't need voice history.

**Acting — the problem:**
- No voice profile to draw from. Zero few-shot examples.
- Drafts are generic. LinkedIn post sounds like a template: "Excited to share that we've released CloudCorrect v2, an open-source tool for AWS auditing with 65 checks across 12 services."
- Confidence score: 0.62 (medium — the scorer knows it sounds generic but the content is factually solid).

**Approval queue:**
- Human sees 3 cards, all flagged "needs your eye."
- Human edits the LinkedIn post: changes "Excited to share" to "Shipped CloudCorrect v2 today." Cuts the second paragraph entirely. Adds a specific client stat. Approves.
- Human skips the Reddit post — reason: "too generic."
- Human approves the GitHub README update as-is.

**What the engine learns from this single session:**
- Edit diff: "Excited to share that we've released" → "Shipped." Strong signal: this human opens with the action, not the emotion.
- Edit diff: second paragraph removed. Signal: this human prefers shorter posts.
- Edit addition: client stat. Signal: this human values specific numbers over general claims.
- Skip reason (too generic) on Reddit: Signal: Reddit needs more technical depth than what was generated.
- GitHub approved as-is: Signal: technical/factual content needs less voice adjustment.

**Gap found:** The cold start is unavoidable, but the learning from a single session is meaningful only if the edit diffs are captured with enough granularity. A simple "original vs approved" comparison isn't enough — the engine needs to know WHICH parts were changed and classify the type of change (tone, structure, length, addition, removal).

**REFINEMENT D1:** Edit diff analysis must classify changes into categories: tone change, structural change, content addition, content removal, length adjustment. Each category feeds a different part of the voice profile.

### D2. Week 4 — Voice Emerging

**Setup:** 20 posts approved over 4 weeks. 6 were edited before approval. 4 were skipped. 10 were approved as-is.

**Acting — the improvement:**
- Drafts now open with action verbs ("Shipped", "Built", "Released") instead of emotion ("Excited to share").
- LinkedIn posts are 3 paragraphs (matching the human's edit pattern).
- Reddit posts include a "Technical details" section (learned from early skip reasons + the posts that were approved).
- Confidence scores averaging 0.78 (up from 0.62 in Week 1).

**Approval queue:**
- Human approves 3 of 4 cards without edits.
- Edits 1 card: changes a single word ("developed" → "built"). Minor.
- Approval rate: 75% without edits. Up from ~30% in Week 1.

**What's happening under the hood:**
- Voice profile now has 20 approved posts as few-shot examples.
- The 6 edit diffs have taught tone, structure, and length preferences.
- The 4 skip reasons have created negative examples (what NOT to do).
- Confidence scorer is better calibrated — its 0.78 scores are landing in the "approve" zone more often.

**No gap found.** This progression is expected and healthy.

### D3. Month 3 — Voice Locked In

**Setup:** 60+ posts approved. Voice profile is strong. Approval rate >80%.

**The test — does the engine handle voice evolution?**

The human's voice subtly shifts over 3 months. They used to write formal LinkedIn posts. Now they're more casual — shorter sentences, occasional incomplete sentences, more direct.

**Risk:** The engine's voice profile is built on 60+ historical posts. The older posts (formal) outnumber the recent posts (casual). Does the engine lag behind the human's evolution?

**Acting:** Drafts are still slightly formal. Human edits 2 posts back to casual tone. Skips one with "tone wrong."

**Gap found:** Voice profile weights all approved posts equally. A post approved 3 months ago has the same influence as a post approved yesterday.

**REFINEMENT D2:** Voice profile must apply recency weighting. Recent approvals (last 30 days) have 3x the weight of older approvals. Recent skips/edits have 5x the weight. This allows the profile to evolve with the human without losing foundational patterns.

### D4. Month 6 — Platform Voice Divergence

**Setup:** The human's LinkedIn voice and Reddit voice have diverged significantly. LinkedIn posts are polished and outcome-focused. Reddit posts are raw, technical, and conversational.

**Acting:** Drafts a LinkedIn post that sounds like a Reddit post (too casual, too technical for LinkedIn audience).

**Human:** Edits heavily. Changes tone entirely. Approves.

**Gap found:** Single voice profile across all platforms. The human actually has different voices for different platforms — this is normal and expected.

**REFINEMENT D3:** Voice profile must be per-platform, not global. Each platform accumulates its own few-shot examples, edit patterns, and skip reasons. A LinkedIn voice profile and a Reddit voice profile can be very different for the same human.

---

## SIMULATION E: STRATEGIST FAILURE AND STALE DIRECTIVES

### E1. Strategist Fails for 1 Week (All Company Types)

**Setup:** Weekly Strategist run fails (Managed Agent timeout). Operational agents have last week's directives.

**Noticing:** Runs normally. Uses last week's directives for context. Extraction quality is unaffected — directives influence prioritisation, not extraction.

**Acting:** Runs normally. Channel weights and angle defaults are 1 week stale. This is almost certainly fine — strategy doesn't change weekly in dramatic ways.

**Reviewing:** Runs normally. Collects signals. Writes to DB. The Strategist will have 2 weeks of data to process on next successful run.

**Outcome:** Functionally identical to normal operation. One stale week is invisible to the human.

**No gap found.** The system is resilient to a single Strategist failure.

### E2. Strategist Fails for 3 Consecutive Weeks

**Setup:** Three weeks of Strategist failures. Directives are 3 weeks stale.

**Week 1-2:** No visible degradation. See E1.

**Week 3:** Problems emerge:
- An asset that had strong traction 3 weeks ago is still marked as high priority, even though engagement has dropped.
- Channel weights haven't adapted to a platform algorithm change (LinkedIn engagement dropped 30% across the board due to a feed change).
- A new asset was registered 2 weeks ago but has no Strategist assessment — it's stuck at default priority (0.5).
- No narrative assessment has run. Drift could be accumulating undetected.

**Acting:** Still drafting, but drafts are optimising for stale signals. Confidence scores are still high (the scorer doesn't know the directives are stale), but actual post performance is declining.

**Reviewing:** Catches the performance decline in weekly summary. Notes: "Engagement down 25% across LinkedIn. No Strategist directives updated in 3 weeks."

**Human:** Reads weekly summary, sees the flag. Can manually trigger a Strategist run.

**Gap found:** The engine doesn't proactively alert the human that the Strategist has failed. The weekly summary mentions it, but only if the human reads it. If the human is in a low-engagement phase (checking queue but not reading summaries), the degradation is silent.

**REFINEMENT E1:** If the Strategist fails for 2+ consecutive weeks, escalate to a direct notification (push notification or email) outside the normal weekly summary. Message: "ShipLoop's strategy engine hasn't updated in [X] weeks. Your content is running on stale directives. [Tap to trigger a manual update]."

### E3. Strategist Recovers After 3-Week Gap

**Setup:** Strategist finally runs successfully after 3 weeks of failure.

**Strategist behaviour:** Reads 3 weeks of accumulated data (posts, signals, skips, approvals). Its last monologue entry is 3 weeks old.

**Risk:** The Strategist might overreact to 3 weeks of data. Example: sees a bad week 2 weeks ago, overcorrects, even though week 3 was already recovering naturally.

**Gap found:** Strategist doesn't know it missed 3 weeks. It reads its last monologue entry and assumes it ran last week. The time gap between monologue entries is invisible to it.

**REFINEMENT E2:** Strategist system prompt must include the date of its last successful run and the current date. If the gap is >7 days, the prompt should include: "NOTE: Your last run was [X] days ago. You have [X] weeks of unprocessed data. Account for the time gap in your reasoning — avoid overreacting to patterns that may have already self-corrected."

---

## SIMULATION F: MESSY INPUT (Cross-Type)

### F1. Multi-Topic Brain Dump With Noise

**Brain dump (Software Consulting/Service):**

"Morning. CloudCorrect got 50 GitHub stars overnight which is cool. Had a dentist appointment. New intern started today, seems sharp. Client called about DocProof — they processed 1200 documents yesterday, new record. Need to fix the Jenkins pipeline, it's been flaky. Thinking about whether we should sponsor a local meetup. Oh and we got accepted to speak at AWS re:Invent, haven't told anyone yet."

**Noticing should extract:**
1. CloudCorrect 50 stars overnight → GitHub milestone post. Medium urgency.
2. DocProof 1200-document record → client outcome post. High urgency.
3. AWS re:Invent acceptance → speaking/credibility post. High urgency.

**Noticing should ignore:**
- Dentist appointment (not distribution-relevant)
- New intern (not distribution-relevant unless the Strategist directives include "team growth" as a content angle)
- Jenkins pipeline (internal ops, not distribution-relevant)
- Meetup sponsorship (possible distribution, but too vague — no action yet)

**Test:** Does Noticing correctly filter 7 items down to 3? Does it resist the temptation to generate "thought leadership" opportunities from noise?

**Outcome:** Noticing produces 3 opportunities. Correct. The meetup sponsorship is borderline — flagged with low relevance score (0.35) so it won't make it to the approval queue unless the human has a very low queue.

**No gap found.** Noticing's stateless extraction handles messy input well because it's filtering against the asset registry and Strategist directives, not trying to understand everything.

### F2. Brain Dump That's Mostly Emotional Venting

**Brain dump (SaaS/Product):**

"Terrible week. Lost our biggest customer. They went to [competitor]. Support ticket backlog is insane. The team is burnt out. I don't even know if we should be posting anything right now. Maybe I should just focus on the product and forget about content for a while."

**Noticing:**
- Detects emotional state: **stressed**.
- Extracts opportunities (because the data is there):
  1. Lost biggest customer to competitor → NOT an opportunity (negative event, not distribution material). Flagged to Strategist as competitive signal.
  2. "Focus on product" sentiment → NOT an opportunity. Flagged as intent-to-go-silent.
- Outputs: 0 opportunities. Emotional state: stressed. Strategist flag: competitive loss + possible extended silence.

**What happens next:**
- No drafts generated (0 opportunities).
- Strategist receives the flag on next run. Monologue: "Builder is in crisis mode. Lost key customer to competitor. Stated intent to go silent. DO NOT push content. Let the silence threshold handle it naturally. When builder re-engages, first priority: reframe the setback constructively (if builder chooses to). Do not generate competitor-reactive content."

**Gap found (minor):** The emotional state flag only travels to the Strategist on the next weekly run. If this happens on Monday and the Strategist runs on Monday morning (already completed), the flag sits for a week.

**REFINEMENT F1:** Critical emotional state flags (stressed + intent-to-go-silent) should trigger a lightweight Strategist assessment within 24 hours, not wait for the weekly run. This is not a full Strategist session — it's a focused "should we change anything?" check using a shorter prompt and Sonnet instead of Opus, to keep cost low.

### F3. Brain Dump In a Different Language

**Brain dump (Software Consulting/Service, bilingual founder):**

"Shipped a new feature for DocProof. बहुत अच्छा response मिला client से। They want to roll it out to 3 more departments. Also presented at a local AWS meetup — mostly Hindi audience."

**Noticing:** Should handle code-switched input (English + Hindi mixed) without breaking. The opportunities are:
1. DocProof feature + client expansion → LinkedIn (English). High urgency.
2. AWS meetup presentation → LinkedIn (English) + local community (language-appropriate). Medium urgency.

**Gap found:** The spec doesn't address multilingual input or output. If the human's audience includes non-English communities, should the Acting Agent draft in multiple languages?

**REFINEMENT F2:** Noticing should extract language context from brain dumps. If the human mentions a non-English audience, the Acting Agent should be able to draft in that language OR flag it for the human to translate. v1 approach: flag for human review with note "This opportunity may benefit from [language] version." v2 approach: draft in the target language with lower confidence score.

---

## SIMULATION G: QUEUE NEGLECT

### G1. Human Checks Queue 2x Per Week Instead of Daily (SaaS/Product)

**Setup:** Human is busy. Brain dumps are daily, but approval queue is checked Monday and Thursday only.

**Monday queue check:**
- 8 draft cards accumulated over the weekend + Monday morning brain dump.
- 3 oldest cards (from Friday) have reduced relevance — the moments they reference are no longer timely.
- 2 of those 3 are auto-expired (48-hour aging).
- Remaining 6 cards reviewed. 4 approved. 2 skipped.

**Thursday queue check:**
- 6 draft cards accumulated (Tuesday, Wednesday, Thursday brain dumps).
- All relatively fresh. 5 approved. 1 skipped.

**Weekly outcome:** 9 posts published (vs ~12-15 if queue was checked daily). Some timely opportunities missed.

**Engine response:** Reviewing Agent notes the pattern: "Queue checked 2x this week. 2 drafts expired. Timely opportunities (feature launch, user milestone) lost freshness." Strategist adjusts: for this human, prioritise evergreen angles over time-sensitive angles — they survive queue delays better.

**Gap found:** The 48-hour expiry is too aggressive for humans who check the queue 2-3x per week. But extending it globally would mean stale content sits for too long for daily-queue humans.

**REFINEMENT G1:** Queue aging should be configurable during onboarding (or auto-learned from behaviour). Default 48 hours. If the engine detects that the human consistently checks the queue less than daily, extend to 72 or 96 hours and adjust the Strategist to favour less time-sensitive angles.

### G2. Human Approves Everything Without Reading (Solo Creator/Educator)

**Setup:** Human is in a rush. Approval queue has 5 cards. Human taps Approve on all 5 in under 30 seconds.

**Signal:** The engine receives 5 approvals with no edits and no skips. On the surface, this looks like perfect output — 100% approval rate, no corrections needed.

**Problem:** The human didn't actually read the drafts. One of them has a factual error (wrong version number). Another has a tone that doesn't match the platform. Both get posted.

**Reviewing Agent (end of week):** The factually incorrect post got called out in comments. The mismatched-tone post underperformed.

**Gap found:** The engine can't distinguish between "approved because it's good" and "approved because the human didn't read it." Rapid-fire approvals (all cards approved in <60 seconds) should be treated as a weaker signal than thoughtful approvals.

**REFINEMENT G2:** Track approval velocity. If all cards are approved in under 60 seconds (indicating rubber-stamping), the approvals are logged but given reduced weight in voice profile learning. A gentle one-time nudge: "Quick approvals detected. ShipLoop works best when you spend a moment on each card — your edits and skips are how the engine learns your voice."

### G3. Human Abandons Queue for 2 Weeks (Software Consulting/Service)

**Setup:** Human stops checking the approval queue entirely. Brain dumps continue sporadically.

**Day 1-3:** Drafts accumulate. 6 cards in queue. All expire after 48 hours.

**Day 4-7:** Noticing continues processing brain dumps. Acting continues generating drafts. All expire.

**Day 8-14:** No brain dumps either. Full silence. Burnout Protocol activates (threshold: 14 days for consulting/service).

**Burnout Protocol:**
- Day 14: Nudge notification. "Here are 3 ideas from your recent work. Tap to approve one."
- Day 15: No response. Engine posts from evergreen bank (if configured). If not configured, waits.
- Day 16-21: One evergreen post every 3-4 days. Minimal presence maintained.

**Human returns Day 22:**
- Queue is empty (everything expired).
- Strategist has logged the 2-week gap.
- First brain dump processed normally.
- Strategist monologue: "Builder returned after 22-day absence. Don't overwhelm with backlog. Ease back in: 1 post this week from today's brain dump. Resume normal cadence next week."

**Gap found (minor):** When the human returns, they have no visibility into what the engine did during their absence. The evergreen posts went out, but the human might not know.

**REFINEMENT G3:** On return from extended silence (>1 week), show a "While you were away" summary in the approval UI: what was posted from evergreen bank, engagement on those posts, and Strategist's current assessment.

---

## CONSOLIDATED SUPPLEMENTARY REFINEMENTS TABLE

| Ref | Refinement | What Changes | Priority |
|---|---|---|---|
| D1 | Edit diff categorisation | Edit diffs classified into tone/structure/content/length changes for better voice learning | Must Have |
| D2 | Recency-weighted voice profile | Recent approvals weighted 3x, recent skips 5x over historical | Must Have |
| D3 | Per-platform voice profile | Separate voice profile per platform, not one global profile | Must Have |
| E1 | Strategist failure escalation | Direct notification after 2+ consecutive Strategist failures | Should Have |
| E2 | Strategist time-gap awareness | Include last-run date and gap duration in Strategist prompt | Must Have |
| F1 | Critical emotional state fast-check | Stressed + intent-to-go-silent triggers lightweight Strategist check within 24h | Should Have |
| F2 | Multilingual input handling | Extract language context, flag non-English opportunities for human review | Nice to Have |
| G1 | Configurable queue aging | Auto-learn queue check frequency, adjust card expiry and angle selection | Should Have |
| G2 | Approval velocity tracking | Detect rubber-stamping, reduce voice profile learning weight, one-time nudge | Should Have |
| G3 | "While you were away" summary | Show what happened during extended silence when human returns | Should Have |

---

## COMBINED SIMULATION CONCLUSION

The original 9 simulations (A1-C3) stress-tested the **operational layer** — what happens when content flows through the pipeline across different company types and time horizons.

These supplementary simulations stress-test the **learning layer** and **degradation paths**:

- **D-series (Voice Profile):** The engine's most important compounding asset is the voice profile. It needs recency weighting, per-platform separation, and structured edit diff analysis to actually improve over time. Without these, the engine gets stuck at "generic but accurate" and never reaches "sounds like you."

- **E-series (Strategist Failure):** The system is resilient to short outages but degrades after 2+ weeks. The Strategist needs time-gap awareness and the human needs proactive notification of failures.

- **F-series (Messy Input):** Noticing handles noise well by design (stateless, filters against asset registry). Emotional venting needs faster Strategist awareness. Multilingual input is a v2 concern.

- **G-series (Queue Neglect):** The 48-hour expiry assumes daily queue checks. Real human behaviour varies. The engine needs to adapt its expectations to the human's actual behaviour pattern, not the ideal one.

**The meta-insight:** The original simulations found that the engine's highest-value moments are the quarterly reviews and strategic pushbacks. These supplementary simulations add: the engine's highest-risk moments are when the human disengages — either by going silent, rubber-stamping, or ignoring summaries. The engine must detect disengagement patterns and adapt, not just keep running as if nothing changed.
