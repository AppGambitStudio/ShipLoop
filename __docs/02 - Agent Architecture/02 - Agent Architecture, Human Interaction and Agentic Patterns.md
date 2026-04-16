# SHIPLOOP — Agent Architecture, Human Interaction and Agentic Patterns

Spec Section 02 — Detailed

---

## 1. AGENT ARCHITECTURE

Four agents in a hierarchy. Strategist sits above and directs. Three operational agents execute beneath it. No agent acts in isolation — every agent receives context from the Strategist's directives.

```
                    ┌─────────────────┐
                    │   STRATEGIST    │  ← The brain. Thinks. Directs. Has memory.
                    │   (weekly +     │
                    │    quarterly)   │
                    └────────┬────────┘
                             │
                    Directives (JSON)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌─────────────┐  ┌─────────────┐
     │  NOTICING  │  │   ACTING    │  │  REVIEWING  │
     │  (on each  │→ │(after each  │  │  (weekly    │
     │ brain dump)│  │ opportunity)│  │   cron)     │
     └────────────┘  └─────────────┘  └─────────────┘
           │               │               │
      Opportunities    Drafted Content   Signal Summary
                           │               │
                      Approval Queue       │
                           │               │
                      Posted Content ──────┘
                                    (engagement data flows back)
```

### Data Flow — The Full Pipeline

Here's what happens from the moment you submit a brain dump to the moment content is posted and measured:

```
1. Human submits brain dump (text or voice)
   ↓
2. [NOTICING AGENT] processes brain dump
   - Receives: raw text + asset registry + Strategist directives
   - Detects emotional state (neutral/stressed/excited)
   - Extracts structured opportunities (what happened, angle, channels, urgency)
   - Outputs: JSON array of opportunities
   ↓
3. [ACTING AGENT] processes each opportunity (in parallel)
   - Receives: opportunity + channel registry + voice profile + Strategist directives
   - Drafts platform-specific content for each relevant channel
   - Self-scores confidence (0-1) per draft
   - Tags source (brain_dump / strategist_fallback / signal_amplification)
   - Outputs: draft cards with content, confidence, source tag
   ↓
4. Confidence routing (thresholds vary by company type)
   - Above auto-queue threshold → auto-queued (still needs approval, but presented as "ready")
   - Between review and auto-queue → flagged for review (presented with "needs your eye" indicator)
   - Below review threshold → held (Strategist consulted on next weekly run)
   ↓
5. Human reviews approval queue
   - Approve / Edit & Approve / Skip (with one-tap reason)
   - Skip reasons: Tone wrong / Angle wrong / Timing wrong / Too generic / Other
   - Every action feeds back into voice profile and Strategist memory
   ↓
6. Approved content ready for posting
   - v1: Human copies platform-structured content and posts manually. Reports back with post URL.
   - Future: Auto-publish via pluggable connectors (API-based, browser automation, or hybrid)
   ↓
7. [REVIEWING AGENT] collects signals (weekly)
   - Pulls engagement metrics from all platforms
   - Produces weekly summary with business metric correlation
   - Flags outside-engine posts
   - Writes to DB → Strategist reads on next run
   ↓
8. [STRATEGIST AGENT] runs (weekly + quarterly)
   - Reads all accumulated data
   - Updates internal monologue
   - Issues new directives
   - Adjusts asset priorities
   - Computes drift score (quarterly)
   ↓
   (Back to step 2 — next brain dump processed with updated directives)
```

---

## 1.1 THE STRATEGIST AGENT

The brain of the engine. Does not draft content. Does not post. Thinks big picture and issues directives that govern all other agents.

### Specification

| Property | Value |
|---|---|
| **Trigger** | Weekly cron (Monday morning, after Reviewing Agent completes Sunday night) + on-demand + quarterly |
| **Model** | Claude Opus (reasoning-optimised) via Claude Managed Agents |
| **Memory** | Persistent internal monologue (living markdown, updated each run). Rolling 90-day signal memory via Postgres. |
| **Session duration** | Long-running (5-15 minutes per run via Step Functions) |

### Inputs

The Strategist reads (via custom tools that query Postgres):

1. **Asset registry** — all registered assets with distribution status, priority scores, last distributed dates
2. **Posted content history** — all posts from the last 30 days (weekly) or 90 days (quarterly) with full engagement metrics
3. **Last 2 internal monologue entries** — its own prior reasoning, to maintain continuity of thought
4. **User config** — goal statement, channel registry, company type, signal definitions
5. **Skip/approval patterns** — what the human approved, edited, or skipped and why
6. **Reviewing Agent summaries** — latest weekly signal summary including outside-engine audit

### Outputs

Every Strategist run produces:

1. **Updated internal monologue** (markdown, personal voice, direct — this IS the engine's personality)
2. **Directives JSON** — the operational instructions that Noticing and Acting agents receive:
   ```json
   {
     "channelWeights": { "linkedin": 0.6, "reddit": 0.25, "twitter": 0.15 },
     "contentAngleDefaults": ["proof-of-execution", "client-outcome", "technical-deep-dive"],
     "priorityAssetIds": ["uuid-1", "uuid-2", "uuid-3"],
     "silenceAlarm": false,
     "urgencyOverrides": { "uuid-1": "high" }
   }
   ```
3. **Priority asset list** — ordered, with reasoning per asset
4. **Narrative assessment** — one paragraph: is the story coherent across recent posts?
5. **Drift score** (float 0-1) — how far has content drifted from original goal statement?
6. **Path simulation** (quarterly, or when fork detected) — two projected paths with estimated outcomes

### Weekly Run Behaviour

The Strategist's weekly run follows a consistent reasoning pattern:

1. Read its own last 2 monologue entries (continuity)
2. Read all posts and engagement signals from the last 7 days
3. Read all skip/approval actions from the last 7 days
4. Compare current state against the directives it issued last week
5. Ask: "Did the directives work? What changed? What surprised me?"
6. Reason about what should change for next week
7. Write updated monologue, directives, and priority list

### Quarterly Run Behaviour (every 12 weeks)

The quarterly run is the engine's most valuable output:

1. Read 90 days of posts, signals, and monologue history
2. Re-read the original goal statement from onboarding
3. Compute drift score: how far has the actual content narrative drifted from the stated goal?
4. If drift > 0.4: issue course-correction directive with specific actions
5. If a strategic fork is detected (two viable but incompatible paths): present both paths with projected outcomes. Do NOT choose — present and let the human decide.

### Strategist Behaviour Per Company Type

#### Software Consulting/Service Company

**Thinks in:** Narrative arcs and credibility gaps.

**Primary question:** "Do the last 10 posts collectively tell one clear story about why you hire this team?"

**Monologue character example:**
> "Week 8. The cloud infrastructure posts are landing well with the right audience — 3 CTO connection requests this week alone. But we haven't shown any AI-specific outcomes in 3 weeks. The positioning is 'cloud + AI execution' but we're only proving the cloud half. Next week: force at least one AI outcome post into the pipeline. The DocProof 400-document stat from the brain dump 2 weeks ago was never used — that's the strongest proof point we have."

**Directives lean toward:** Coherence over volume. Cross-asset narratives. Spacing out similar posts. Ensuring the body of work tells one story.

**What triggers alarm:** Incoherent narrative (drift score rising). Too many "insight" posts vs "proof" posts. Wrong audience engaging (marketers instead of CTOs).

#### SaaS/Product Company

**Thinks in:** Funnels and conversion events.

**Primary question:** "Is our content driving trials, or just engagement?"

**Monologue character example:**
> "Week 12. Engagement is strong — Twitter thread about the CSV export feature hit 180 retweets. But trial signups from content are flat for the 3rd week in a row. The high-engagement posts are attracting developers who admire the tech but don't have the problem we solve. The low-engagement case study posts are driving 3x more trials. We're optimising for the wrong metric. Directive: shift to 40% problem-solution content, 30% feature announcements, 30% technical depth. Track trial attribution per post."

**Directives lean toward:** Consistent funnel-feeding. Mixing content types (awareness, education, conversion). Channel-specific CTAs. Volume over perfection.

**What triggers alarm:** High engagement + flat trials (vanity metric trap). Inconsistent posting cadence. Feature announcements without problem framing.

#### Solo Creator/Educator

**Thinks in:** Cadence and trust.

**Primary question:** "How long since the last post? Is the creator's authentic voice coming through?"

**Monologue character example:**
> "Week 5. Creator went silent for 4 days after the sponsor cancellation. Brain dump showed clear stress. The impulse was to 'post everything' — I flagged this as panic-posting and held the line. Resurfaced the contrarian-framing thread that performed 4x above average last month with a fresh angle. It went out under the burnout protocol and got solid engagement. Creator came back on Day 6, saw the post, approved the approach. Trust in the engine is building."

**Directives lean toward:** Never going dark. Cadence above all. Protecting the creator's voice authenticity. Managing energy levels — fewer posts during burnout, more during high-energy phases.

**What triggers alarm:** Silence beyond threshold (3 days). Audience mismatch (wrong people following). Declining subscriber growth rate. Format stagnation (same type of post every time).

#### Indie Builder (Building in Public)

**Thinks in:** Momentum and milestone narrative.

**Primary question:** "Is there a visible story of progress? Can someone who discovers this builder today understand the journey?"

**Monologue character example:**
> "Week 6. Builder has been heads-down for 12 days — no brain dumps. Last public milestone was 'hit 50 users.' Before the silence, the debugging story about Stripe webhooks got 4x the engagement of the metrics update. The audience wants the struggle, not just the wins. When builder re-engages, prioritise: share what was built during the sprint, frame the struggle, include a specific metric. The 'I almost quit' angle from Week 2 was their most-engaged post ever — there's a pattern here."

**Directives lean toward:** Authenticity over polish. Process over outcomes. Sharing struggles as much as wins. Maintaining the building-in-public narrative arc even during quiet periods. Milestone posts when metrics change.

**What triggers alarm:** Long silence with no milestone update (the audience loses the thread). Only sharing wins (feels inauthentic for BIP). Metrics disappearing from posts (the audience wants numbers). Community engagement dropping (HN/IndieHackers comments declining).

---

## 1.2 THE NOTICING AGENT

Takes raw human brain dump and extracts structured distribution opportunities. Does not watch or monitor. Listens when you speak.

### Specification

| Property | Value |
|---|---|
| **Trigger** | On each daily brain dump submission |
| **Model** | Claude Sonnet via OpenRouter (quality-first — emotional state detection and nuanced extraction require stronger reasoning than Haiku) |
| **Memory** | None. Stateless. Receives Strategist directives as context each run. |
| **Latency target** | < 15 seconds from submission to output |

### Inputs

1. **Raw text** (or transcribed voice note via Whisper)
2. **Asset registry** — to match brain dump content to existing assets or flag new ones
3. **Strategist directives** — current channel weights, priority assets, content angle defaults

### Outputs

Structured JSON array of opportunities:

```json
[
  {
    "description": "Shipped Presentify v2 with multi-provider AI support",
    "asset_id": "uuid-of-presentify",
    "angle": "builder-ships-real-tools",
    "suggested_channels": ["linkedin", "reddit:r/SideProject"],
    "urgency": "high",
    "relevance_score": 0.92,
    "target_audience": "CTOs, technical founders",
    "emotional_state": "excited"
  },
  {
    "description": "Client used DocProof on 400 documents in one day",
    "asset_id": "uuid-of-docproof",
    "angle": "proof-of-value-at-scale",
    "suggested_channels": ["linkedin"],
    "urgency": "high",
    "relevance_score": 0.88,
    "target_audience": "enterprise ops teams, document-heavy industries"
  }
]
```

### Process as Content Extraction

For indie builders and building-in-public scenarios, the Noticing Agent extracts distribution opportunities not just from finished work ("I shipped X") but from the process of building itself:

- **Struggles and debugging stories:** "Spent 4 hours debugging a Stripe webhook race condition" → distribution material about the problem-solving process
- **Decisions and trade-offs:** "Decided to go with Postgres over MongoDB because..." → transparent decision-making content
- **Metrics and milestones:** "Hit 100 users" or "Revenue crossed $500 MRR" → milestone celebration / building-in-public update
- **Setbacks and pivots:** "Lost 3 users this week, all citing the same missing feature" → honest building-in-public content
- **Learnings:** "Realised our onboarding was broken because..." → insight content drawn from real experience

The Noticing Agent classifies each opportunity with an `angle` that includes process-oriented options: `building-in-public`, `debugging-story`, `decision-transparency`, `milestone-update`, `setback-reflection`, `learning-from-failure` — in addition to the standard angles like `proof-of-execution`, `feature-launch`, etc.

This is controlled by the Strategist's directives. For the Indie Builder company type, process-as-content angles are prioritised. For Software Consulting/Service, they're deprioritised (clients want to see outcomes, not struggles).

### Emotional State Detection

Before extracting opportunities, Noticing scans the brain dump for emotional signals:

- **Neutral:** Normal processing. Extract and pass through.
- **Stressed:** Flags to output. Acting Agent receives the flag. If urgency is artificially inflated by stress ("need to post everything NOW"), the flag travels to the Strategist's next run for pushback.
- **Excited:** Flags to output. Useful context — excitement often means the brain dump contains a genuine high-value event.

Detection is tone-based, not keyword-matching. "I need to post more" after 5 days of silence = stressed. "Just shipped the biggest feature of the year" = excited.

### Noticing Behaviour Per Company Type

The extraction logic is the same, but the Strategist directives shape what gets prioritised:

#### Software Consulting/Service Company

**Brain dump:** "Shipped CloudCorrect v2. 65 AWS checks. 12 services. MIT licensed. Also had a great client call about AI document processing — they saved 3 days of manual work."

**Extraction:**
1. CloudCorrect v2 launch → GitHub + Reddit r/aws + LinkedIn. High urgency. **Builder angle** (shipped, not theorised).
2. Client outcome (3 days saved) → LinkedIn. High urgency. **Proof-of-value angle** (anonymised outcome).
3. MIT licensing decision → Reddit r/opensource. Medium urgency. **Philosophy angle** (why open source a commercial tool).

**What Noticing does NOT do here:** It doesn't generate a "Thought leadership: the future of cloud auditing" opportunity. The Strategist's directives for this company type de-prioritise "thought" content in favour of "proof" content.

#### SaaS/Product Company

**Brain dump:** "Shipped bulk CSV export. Users asked for it for 3 months. Also, churn call yesterday — user left because no Slack integration. Competitor just raised $5M."

**Extraction:**
1. Bulk CSV export shipped → Twitter thread (problem-first) + Reddit (how-it-was-built) + LinkedIn (user impact). High urgency. **Feature-launch angle**.
2. Churn reason (Slack integration) → Twitter (transparent building-in-public). Medium urgency. **Roadmap-transparency angle**.
3. Competitor fundraise → Flagged to Strategist. NOT turned into an opportunity. **Not direct distribution material** — strategic context only.

**What Noticing does NOT do here:** It doesn't generate a reactive "our competitor raised money but we're bootstrapped and proud" post. Competitor events are flagged to the Strategist for strategic assessment, not turned into immediate content.

#### Solo Creator/Educator

**Brain dump (voice note, while walking):** "Most people learn frameworks by reading docs first. Completely backwards. You should break something first, then read why it broke. Docs are repair manuals, not tutorials."

**Extraction:**
1. Contrarian insight (docs are repair manuals) → Twitter thread (contrarian hook) + Newsletter (expanded take) + YouTube short (voice note as hook). High urgency. **Contrarian-framing angle**.
2. Meta-observation about learning → YouTube long-form script seed. Low urgency. **Framework angle** (could become a recurring series on how people learn wrong).

**What Noticing does NOT do here:** It doesn't extract 5 micro-opportunities. For a solo creator, one strong insight is better than five thin ones. Noticing respects the Strategist directive on quality-per-post vs volume.

#### Indie Builder (Building in Public)

**Brain dump:** "Spent all day on Stripe webhooks. Kept getting duplicate charges because of a race condition. Finally fixed it by adding idempotency keys. Also hit 100 users yesterday. And I'm thinking about raising prices."

**Extraction:**
1. Stripe webhook debugging story → Twitter thread (debugging narrative) + HN (technical depth). High urgency. **Debugging-story angle** (process as content).
2. 100 users milestone → Twitter (milestone update) + IndieHackers (building-in-public update). High urgency. **Milestone-update angle**.
3. Pricing decision → Twitter (decision transparency). Medium urgency. **Decision-transparency angle** (seeking community input).

**What Noticing does here that's different:** It treats the debugging struggle as first-class distribution material, not noise. For a consulting company, "spent all day on Stripe webhooks" would be ignored (internal ops). For an indie builder, it's the most engaging content type — the audience wants the real story of building.

### Edge Cases

**Empty or low-signal brain dump:** "Not much today. Had meetings all day."
→ Noticing outputs zero opportunities. This is correct behaviour. It does NOT manufacture content from nothing. The engine's fallback mode (Strategist directives, evergreen bank) handles silence — not the Noticing Agent.

**Brain dump with multiple unrelated items:** "Fixed a CSS bug. Ate great ramen. CloudCorrect got 50 GitHub stars overnight. Need to buy groceries."
→ Noticing extracts only the distribution-relevant items (CloudCorrect stars). Ignores the rest. Does NOT ask the human to clarify — it's designed to handle messy, stream-of-consciousness input.

**Brain dump that contradicts Strategist directives:** "I want to post about our new office space" (but Strategist has deprioritised non-technical content).
→ Noticing extracts it as an opportunity but assigns low relevance score. The Strategist's directives lower the score, but they don't block it entirely — the human might still approve it in the queue.

---

## 1.3 THE ACTING AGENT

Takes each opportunity and produces ready-to-approve distribution content. Channel-aware. Platform-voice-aware. Confidence-scored.

### Specification

| Property | Value |
|---|---|
| **Trigger** | Immediately after Noticing Agent output (per opportunity) |
| **Model** | Claude Sonnet for drafting AND confidence scoring (via OpenRouter) — quality-first approach; Haiku produced too-generic drafts in cold-start simulations |
| **Memory** | User voice profile — tone, vocabulary, recurring phrases learned from approved posts. Improves with every approval and skip. |
| **Latency target** | < 30 seconds per draft |

### Inputs

1. **Opportunity JSON** — from Noticing Agent
2. **Channel registry** — which platforms are active, any platform-specific constraints
3. **Past high-signal post examples** — the 10 most-engaged approved posts, used as few-shot examples for voice matching
4. **Strategist directives** — channel weights, content angle defaults
5. **User voice profile** — accumulated from approval/skip/edit history

### Outputs

Per opportunity, one or more draft cards:

```json
{
  "opportunity_id": "uuid",
  "platform": "linkedin",
  "target": "main-feed",
  "content": "Full draft text here...",
  "confidence_score": 0.87,
  "source_tag": "brain_dump",
  "reasoning": "Used proof-of-execution angle. Matched tone to approved post from Week 3."
}
```

### Source Tags

Every draft card is tagged with its origin. This is visible to the human in the approval UI:

- **brain_dump** — directly derived from today's brain dump
- **strategist_fallback** — no brain dump today; Strategist directed this based on strategy
- **signal_amplification** — a previous post got strong traction; this is a follow-up or repurpose

### Confidence Scoring

After drafting, the Acting Agent scores its own output using Sonnet (a more capable model than the one that drafted). The score reflects:

- **Voice match** — does this sound like the human? Compared against approved post history.
- **Angle fit** — does the angle match what works for this platform? Based on signal data.
- **Content quality** — is this substantive or generic? Would a human scroll past it?
- **Directive alignment** — does this support the Strategist's current priorities?

Scoring happens as a separate LLM call evaluating the draft. This separation is deliberate — the drafter shouldn't score its own work, even when both calls use the same model.

### Confidence Routing

Thresholds are configurable per company type. Service companies have a higher quality bar (fewer, stronger posts). SaaS founders have a lower bar (volume matters more).

| Company Type | Auto-queue threshold | Review threshold | Below = held |
|---|---|---|---|
| Software Consulting/Service | >= 0.88 | >= 0.65 | < 0.65 |
| SaaS/Product | >= 0.82 | >= 0.60 | < 0.60 |
| Solo Creator/Educator | >= 0.85 | >= 0.62 | < 0.62 |

| Routing | Action |
|---|---|
| Above auto-queue threshold | Auto-queued for approval. Presented with a "ready" indicator. |
| Between review and auto-queue | Flagged for review. Presented with a "needs your eye" indicator. |
| Below review threshold | Held. Not shown in approval queue. Strategist reviews on next weekly run and decides whether to retry with different angle or discard. |

### Voice Profile — How It Builds Over Time

The voice profile is not a static configuration. It's an evolving, per-platform model built from the human's actions and stored in a dedicated Postgres table (`voice_profile_entries`).

**Per-platform separation:** The human's LinkedIn voice and Reddit voice can be very different — LinkedIn polished and outcome-focused, Reddit raw and technical. Each platform accumulates its own few-shot examples, edit patterns, and skip reasons independently. The Acting Agent queries only the relevant platform's entries when drafting.

**Week 1:** Generic voice. Drafts sound like "a LinkedIn post about X." Approval rate ~50%.

**Week 4:** Vocabulary patterns emerging. The engine knows you say "shipped" not "launched." You say "we built" not "we developed." You don't use exclamation marks. You prefer short paragraphs.

**Week 8:** Structural patterns. You tend to open with the outcome, not the process. Your LinkedIn posts are 3-4 short paragraphs. Your Reddit posts are longer with technical detail.

**Month 3:** Angle preferences. You never approve "excited to share" framings. You always approve "here's what happened" framings. Your best-performing posts start with a specific number or metric.

**Month 6:** The engine sounds like you. Approval rate >80%. Edits are minor (word choice, not structural). Skips are rare and usually timing-related, not quality-related.

**What feeds the voice profile (4 entry types):**
- **approved_post** (weight: 1.0) — positive signal, "more like this"
- **edit_diff** (weight: 2.0) — the diff between draft and approved version, categorised into: tone change, structural change, content addition, content removal, length adjustment. This is the strongest learning signal.
- **skip_signal** (weight: 1.5) — negative signal with reason, "this specifically is wrong"
- **engagement_signal** (weight: 0.5) — what the audience responded to, reinforces patterns that work

**Recency weighting:** Recent entries dominate. Weight decays by 5% per week (`weight * 0.95^weeks`). This means the voice profile evolves with the human — if they shift from formal to casual over 3 months, recent casual approvals outweigh older formal ones without losing the foundational patterns entirely.

**Storage:** Postgres table, not S3 JSON. Grows linearly (~5-15 entries/week). Acting Agent queries: "top 10 highest-weighted approved posts for LinkedIn" = one indexed query. See Doc 05 schema for full table definition.

### Acting Behaviour Per Company Type

#### Software Consulting/Service Company

**Drafting character:** Professional but not corporate. Technical specificity. Numbers and outcomes over adjectives. Never sounds like marketing.

**Platform adaptation:**
- **LinkedIn:** Outcome-first. "Shipped X. Here's what it does. Here's a client result." 3-4 paragraphs. No hashtag spam. Maybe one relevant hashtag.
- **Reddit:** Technical depth. Setup guide or architecture walkthrough. Longer format. Answers the "how" not just the "what."
- **GitHub:** README-focused. Clear problem statement, installation, usage examples.

**What it avoids:** "Excited to announce" openings. Marketing language. Vague thought leadership. Anything that sounds like it was written by a social media manager.

#### SaaS/Product Company

**Drafting character:** Direct, problem-first. Every post implicitly or explicitly connects back to the product. Not salesy — demonstrates value through use cases.

**Platform adaptation:**
- **Twitter/X:** Thread format. Opens with the problem ("You know that thing where..."). Middle shows the solution. Ends with a subtle CTA or link.
- **Reddit:** Community-appropriate. Leads with the problem/insight. Product mention is secondary. Provides genuine value even without the product.
- **LinkedIn:** User impact stories. "A user had X problem. Here's how they solved it." Case study format.
- **Product Hunt:** Launch-specific. Pre-drafted response bank for common questions.

**What it avoids:** Pure feature announcements without problem context. "We're hiring" mixed with product content. Engagement bait.

#### Solo Creator/Educator

**Drafting character:** Authentic, opinionated, conversational. The creator's actual voice — not a polished version of it. Imperfect grammar is sometimes correct if that's how the creator writes.

**Platform adaptation:**
- **YouTube (short script):** Hook in first 3 seconds. Contrarian or surprising statement. Script is a skeleton, not a teleprompter read.
- **YouTube (long-form seed):** Outline with key points and transitions. Not a full script — the creator riffs.
- **Newsletter:** More personal, reflective. References shared context with subscribers. Feels like a letter, not a broadcast.
- **Twitter/X:** One punchy take. Thread if the idea has layers. Voice note excerpt as hook if available.

**What it avoids:** Polished "content creator" voice. Clickbait. Generic advice. Anything that could have been written by anyone.

#### Indie Builder (Building in Public)

**Drafting character:** Raw, honest, metric-included. The builder's real experience — struggles alongside wins. Specific numbers always. Never polished to the point of losing authenticity.

**Platform adaptation:**
- **Twitter/X:** Thread format for stories ("Let me tell you about the 4 hours I spent on Stripe webhooks today..."). Single tweet for milestones ("Hit 100 users. Here's what I learned getting from 50 to 100."). Always includes a specific number.
- **Hacker News:** Technical depth required. The post must stand alone as valuable even if no one cares about the product. "Show HN" format for launches. Comment-worthy technical decisions for discussion posts.
- **IndieHackers:** Building-in-public update format. Revenue/user metrics required. Honest about what's working and what isn't. The community penalises hype and rewards transparency.
- **Reddit:** Subreddit-appropriate (r/SideProject for launches, r/startups for milestone reflections, niche subreddits for technical depth). Lead with the story, not the product.
- **Dev.to / Hashnode:** Technical blog format. Longer-form debugging stories, architecture decisions, "how I built X" posts. SEO-friendly titles.

**What it avoids:** Vanity metrics without context ("10K impressions!" — so what?). Fake humility. Over-polished startup speak. Anything that reads like a press release.

---

## 1.4 THE REVIEWING AGENT

Runs weekly. Pulls engagement signals. Produces one human-readable summary. Feeds data back to the Strategist.

### Specification

| Property | Value |
|---|---|
| **Trigger** | Weekly cron (Sunday night) — must complete before Strategist's Monday morning run |
| **Model** | Claude Sonnet for signal parsing and summary generation (via OpenRouter) |
| **Memory** | None. Stateless. Writes to persistent DB which Strategist reads. |
| **Latency target** | < 5 minutes for full weekly run |

### Inputs

1. **All posted content from the last 7 days** — with engagement metrics pulled from each platform
2. **Asset registry** — to correlate posts back to assets
3. **User config** — signal definitions (what metrics matter per company type)
4. **Previous week's summary** — for comparison and trend detection

### Outputs

1. **Weekly signal summary** — human-readable, delivered as a single message or email
2. **Updated engagement records** — written to Postgres for Strategist
3. **Traction flags** — which posts crossed engagement thresholds (none / some / strong)
4. **Outside-engine audit** — any posts detected that were made outside ShipLoop

### Signal Collection Per Platform

**v1 — manual + lightweight scraping:** The human reports post URLs after publishing. The Reviewing Agent visits each URL and scrapes publicly available engagement data. No API keys required.

**Future — auto-retrieve via connectors:** Pluggable platform connectors (API-based or browser automation) that automatically pull engagement signals without the human reporting.

**What signals matter per platform:**
- **LinkedIn:** Impressions, reactions, comments, shares, profile visits, connection requests (high-value signal)
- **Reddit:** Upvotes, comments, cross-posts. Subreddit-specific benchmarking (50 upvotes in r/SideProject ≠ 50 in r/devops)
- **Twitter/X:** Impressions, retweets, replies, quote tweets, profile visits. Thread performance tracked as a unit.
- **Hacker News:** Points, comment count, rank position, time on front page
- **IndieHackers:** Upvotes, comments, DMs received
- **GitHub:** Stars, forks, issues opened
- **Newsletter:** Open rate, click rate, reply count, unsubscribes
- **YouTube:** Views, watch time, subscriber change, comments
- **Dev.to/Hashnode:** Views, reactions, comments, bookmarks

### Weekly Summary Structure

The summary is designed to be consumed in 5 minutes or less:

```
SHIPLOOP WEEKLY SIGNAL SUMMARY — Week of [date]

HEADLINE: [One sentence — the most important thing that happened]

TOP PERFORMERS:
• [Post title/excerpt] on [platform] — [key metric]. [Why it worked.]
• [Post title/excerpt] on [platform] — [key metric]. [Why it worked.]

UNDERPERFORMERS:
• [Post title/excerpt] on [platform] — [key metric]. [What might have been off.]

BUSINESS OUTCOME CORRELATION:
• [X] posts published → [Y] inbound enquiries / trial signups / subscriber adds
• Conversion rate this week: [Z]%
• Compared to last week: [trend]

OUTSIDE ENGINE AUDIT:
• [Any posts made directly on platforms, not through ShipLoop]
• [Brand impact assessment if applicable]

STRATEGIST PRIORITY FOR NEXT WEEK:
• [From Strategist directives — what's planned for next week and why]
```

### Reviewing Behaviour Per Company Type

#### Software Consulting/Service Company

**Signal focus:** Inbound enquiry rate. Profile visits from target companies. CTO/VP Engineering connection requests. The number of impressions matters less than WHO is engaging.

**Summary character:** "3 posts published. 1 drove meaningful engagement — the CloudCorrect deep-dive reached 4 CTOs at target companies. The other 2 had standard engagement but no high-value signals. Recommend continuing the technical depth angle on LinkedIn."

**Business metric:** Inbound enquiries and qualified connection requests.

#### SaaS/Product Company

**Signal focus:** Trial signups attributed to content. Click-through rate to landing page. Keyword ranking movement. Churn recovery signals.

**Summary character:** "5 posts published across 3 platforms. Twitter thread drove 12 trial signups (best this month). Reddit post drove 3 signups but 40% converted to paid (highest conversion channel). LinkedIn post got high engagement but 0 signups — pure awareness play."

**Business metric:** Trial signups and signup-to-paid conversion from content.

#### Solo Creator/Educator

**Signal focus:** Subscriber growth rate. Email open rate and reply rate. Watch time on YouTube. Comment depth (one-word comments vs substantive discussion).

**Summary character:** "4 pieces published. Newsletter had a 48% open rate (up from 42% average). YouTube short hit 180K views — contrarian framing outperformed how-to by 4x again. No new content for 2 days — approaching silence threshold."

**Business metric:** Subscriber growth rate and revenue per subscriber (sponsorship/course sales).

#### Indie Builder (Building in Public)

**Signal focus:** Community engagement quality (substantive comments vs drive-by upvotes). HN rank and comment count. IndieHackers post engagement. Twitter thread completion rate. Follower growth from builder-audience (other indie devs, potential users, investors).

**Summary character:** "3 posts published. The Stripe webhook debugging thread on Twitter got 340 retweets and 28 substantive replies — your debugging stories consistently outperform milestone updates by 3x. The '100 users' milestone post on IndieHackers drove 4 DMs from potential users. HN submission didn't get traction (posted at wrong time — try Tuesday morning EST next time)."

**Business metric:** User signups attributed to building-in-public content. Community DMs from potential users/collaborators. Follower growth in builder-audience segments.

### Outside-Engine Audit

The Reviewing Agent tracks posts made directly to platforms (bypassing ShipLoop). This matters because:
- Posts made outside the engine don't benefit from the voice profile
- They can break narrative coherence without the Strategist knowing
- The worst case (from simulations): an emotional post made directly to Twitter during a stressful moment

**v1 approach — manual entry:**
The human self-reports outside-engine posts via a simple form in the approval UI: platform, link, and optional note. This is low-friction (one field) and avoids the complexity of platform API integrations in early phases. The Reviewing Agent includes these in the weekly summary with a neutral tone (not punitive) and the Strategist factors them into narrative assessment.

The `posted_content` table already supports this via the `is_outside_engine` boolean flag.

**Future — pluggable integrations:**
Platform connectors that automatically detect outside-engine posts by comparing the user's platform activity against `posted_content` records. Each platform becomes a plugin: LinkedIn (via API), Reddit (via user profile .json), Twitter/X (via API), etc. The manual entry path remains as fallback for platforms without connectors.

---

## 2. HUMAN INTERACTION DESIGN

Three touch points only. Everything else is automated. If the human has to do more than these three things, the engine has failed.

### Touch Point 1: Daily Brain Dump (2 minutes)

**What it is:** Text field or voice recorder. No structure required. Stream of consciousness accepted.

**Interaction:**
- Submit and close. That's it.
- Engine processes immediately (Noticing Agent triggers within seconds).
- Drafts appear in approval queue within minutes.

**What the human does NOT need to do:**
- Categorise the brain dump
- Tag assets
- Select channels
- Set priority
- Format anything

**Voice input flow:**
1. Record voice note (mobile or desktop)
2. Whisper transcribes to text
3. Original audio stored in S3 (for Acting Agent to potentially use as content hook)
4. Transcribed text processed by Noticing Agent identically to text input

### Touch Point 2: Approval Queue (5-10 minutes, once daily)

**What it is:** Card-based UI. One card per drafted piece of content.

**Each card shows:**
- Platform icon and target (e.g., LinkedIn / main feed, Reddit / r/SideProject)
- Full draft content
- Confidence score (visual indicator, not just a number)
- Source tag: Brain Dump / Strategist Fallback / Signal Amplification
- The asset it relates to
- Reasoning: why this draft was created (one sentence from Acting Agent)

**Actions per card:**
- **Approve** — content goes to posting queue
- **Edit & Approve** — opens inline editor, then goes to posting queue. The diff between original and edited version is the strongest voice profile learning signal.
- **Skip** — one-tap reason required:
  - Tone wrong
  - Angle wrong
  - Timing wrong
  - Too generic
  - Other (optional free text)

**Queue behaviour:**
- Cards sorted by confidence score (highest first)
- High-confidence cards (>0.85) have a "ready" indicator — human can approve with minimal review
- Medium-confidence cards (0.60-0.85) have a "needs your eye" indicator
- Low-confidence cards (<0.60) are not shown — they're held for Strategist review

**What happens if the human doesn't check the queue:**
- Nothing is posted without approval (unless burnout protocol is active and pre-approved evergreen content is in the bank)
- Unapproved drafts age out after a configurable window (default 48 hours, stored in `user_config.queue_expiry_hours`) and are logged as "expired" — the Strategist sees this as a signal
- If the engine detects the human consistently checks the queue less than daily, it auto-extends the expiry window and adjusts the Strategist to favour less time-sensitive angles

### Touch Point 3: Weekly Signal Summary (5 minutes, passive read)

**What it is:** Single message delivered via email or in-app notification. Not a dashboard — a message.

**Contains:**
- What got traction and what didn't
- Business outcome correlation (not just engagement vanity metrics)
- Strategist priority for next week
- Outside-engine audit
- Quarterly: drift score and path simulation when strategic fork is detected

**What the human does with it:**
- Reads it. That's it.
- If something seems off, they can trigger a manual Strategist run
- If a strategic fork is presented, they make a choice

---

## 3. SPECIAL MODES

### 3.1 Burnout Protocol

**Trigger:** Human silence exceeds user-configured threshold (default varies by company type).

**Pre-requisite:** Human must have pre-approved an evergreen bank during onboarding or at any time after. This is explicit opt-in — the engine never posts without approval unless this is configured.

**Behaviour:**
1. Day 1 past threshold: Gentle nudge. "Here are 3 ideas from last week's comments/signals. Thumbs up if any feel right."
2. Day 2 past threshold: No response. Engine draws from evergreen bank. Posts one pre-approved piece with light contextual update.
3. Ongoing silence: One evergreen post per cycle (varies by company type). Never more than what the human pre-approved.
4. Human returns: Normal mode resumes immediately. Strategist logs the silence period and adjusts next week's directives accordingly.

**Per company type thresholds:**
- Software Consulting/Service: 14 days (low volume = long runway)
- SaaS/Product: 7 days
- Indie Builder: 10 days (audience expects bursts, tolerates quiet periods, but the narrative needs to resume)
- Solo Creator/Educator: 3 days (audience expects high frequency)

### 3.2 Launch Mode

**Trigger:** Manually activated by the human before a high-stakes event (Product Hunt launch, conference talk, major release).

**Behaviour:**
- Noticing Agent monitors for brain dumps every 30 minutes (vs normal daily cadence)
- Acting Agent pre-drafts 10-15 response templates for anticipated scenarios (questions, objections, feature requests)
- Approval UI switches to rapid-fire mode (simplified cards, faster approve flow)
- Auto-deactivates after 24 hours

**When to build:** Phase 10 — after core loop is stable. Not needed for MVP.

---

## 4. AGENTIC PATTERNS USED

### 4.1 Hierarchical Agent Architecture
Strategist → Noticing → Acting → Reviewing. Defined scope per agent. Prevents context pollution. No agent tries to do another agent's job.

### 4.2 Persistent Memory with Structured State
The Strategist reasons over time, not just the current moment. Its internal monologue IS the engine's long-term brain. This is stored in Postgres, not in the AI model's context window.

### 4.3 Human-in-the-Loop at Approval Only
The human is not in the loop for thinking, drafting, scheduling, or reviewing signals. Only for approval. Every additional touch point is a failure mode — it means the engine is leaking complexity back to the human.

### 4.4 Confidence-Based Routing
The Acting Agent scores its own output. High confidence = fast path. Low confidence = held for strategic review. This creates a graceful degradation path and improves over time as the voice profile builds.

### 4.5 Pull-Based Input (Not Push-Based Monitoring)
The human is the sensor. The agent is the processor. This is a deliberate design choice:
- **Why not monitor?** Monitoring (scraping GitHub, watching Slack, tracking commits) creates integration maintenance burden, generates noise, and misses context that only the human has.
- **Why pull?** A 2-minute brain dump from the human contains richer signal than 24 hours of automated monitoring. The human knows what matters. The engine knows what to do with it.

### 4.6 Voice Profile as Implicit Fine-Tuning
Few-shot examples from approved history. Edit diffs as the strongest learning signal. Output sounds like you because it learned from your approvals, not because you wrote a style guide.

### 4.7 Separation of Drafting and Scoring
The Acting Agent drafts and then scores in a separate LLM call — even though both use Sonnet, the scoring call receives the draft as input with a different system prompt focused purely on evaluation. The drafter doesn't score its own work in the same call — this prevents confidence inflation and catches quality issues the drafter can't see.

### 4.8 Stateless Operational Agents, Stateful Strategic Agent
Noticing and Reviewing are stateless — they process input and produce output with no memory of prior runs. The Strategist is the only agent with persistent memory. This keeps the operational layer simple and the strategic layer deep.

---

## 5. ERROR STATES AND RECOVERY

### Brain dump processing fails (Noticing Agent error)
- Brain dump is saved to DB regardless
- Error logged, human is NOT notified (it's a background process)
- Retry after 5 minutes (SQS redelivery)
- After 3 failures: flag in next weekly summary. Brain dump available for manual review.

### Draft generation fails (Acting Agent error)
- Opportunity still exists in DB
- Retry after 5 minutes
- After 3 failures: opportunity flagged for Strategist review on next weekly run

### Posting fails (platform connector error — future, not v1)
- v1 is manual posting, so this error state only applies when auto-publish connectors (Phase 10) are active
- Draft stays in "approved" state
- Retry with exponential backoff (5min, 15min, 1hr)
- After 3 failures: human notified. Card reappears in approval queue with "posting failed — post manually" indicator.

### Strategist run fails (Managed Agent timeout/error)
- Step Functions retry with backoff (built into state machine)
- After 3 failures: last week's directives continue to apply. Error flagged in weekly summary.
- The engine does NOT stop working if the Strategist fails — operational agents continue with stale directives. This is degraded but functional.

### Platform API rate limit or outage
- Posts queued, not dropped
- Retry with platform-specific backoff
- Weekly summary notes any delayed posts
