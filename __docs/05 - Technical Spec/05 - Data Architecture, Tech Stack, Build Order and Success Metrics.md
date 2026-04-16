# SHIPLOOP — Technical Specification

Spec Section 05

> **Note:** This is the original product-level tech spec. For the implementation-level technical specification (SST v4, Drizzle schema code, Step Functions, Claude Managed Agents), see `ShipLoop-TechImpl-v1.md` in the docs root.

---

## 1. Data Architecture

PostgreSQL. Flat schema. Linear chain.

```
InputDump -> Opportunities -> DraftedContent -> PostedContent -> EngagementSignal
```

### TABLE: assets

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| one_liner | text | |
| category | enum | open_source, product, content, talk |
| github_url | text | |
| live_url | text | |
| target_audience | text | |
| distribution_status | enum | undistributed, in_progress, distributed, amplified |
| last_distributed_at | timestamp | |
| priority_score | float | Set by Strategist weekly, 0-1 |
| created_at | timestamp | |

### TABLE: input_dumps

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| raw_text | text | |
| source | enum | text, voice |
| voice_transcript | text | Whisper output |
| emotional_state_flag | enum | neutral, stressed, excited (from sim C2) |
| processed_at | timestamp | |
| created_at | timestamp | |

### TABLE: opportunities

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| input_dump_id | uuid FK | |
| asset_id | uuid FK | Nullable if new asset |
| description | text | |
| angle | text | |
| urgency | enum | high, medium, low |
| relevance_score | float | 0-1 |
| created_at | timestamp | |

### TABLE: drafted_content

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| opportunity_id | uuid FK | |
| platform | enum | reddit, linkedin, twitter, youtube, newsletter, github_readme, hackernews, indiehackers, devto, other |
| target | text | Subreddit, LinkedIn tag, YouTube channel, etc. |
| content | text | |
| confidence_score | float | 0-1 |
| source_tag | enum | brain_dump, strategist_fallback, signal_amplification (from sim A1) |
| approval_status | enum | pending, approved, edited, skipped |
| skip_reason | enum | tone_wrong, angle_wrong, timing_wrong, too_generic, other (from sim A2) |
| approved_content | text | |
| approved_at | timestamp | |
| created_at | timestamp | |

### TABLE: posted_content

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| drafted_content_id | uuid FK | |
| platform_post_id | text | |
| posted_at | timestamp | |
| post_url | text | |
| engagement_last_checked | timestamp | |
| upvotes | int | |
| comments | int | |
| traction_flag | enum | none, some, strong |
| is_outside_engine | boolean | From sim B1 |

### TABLE: strategist_memory

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| week_of | date | |
| internal_monologue | text | Markdown, living document |
| directives | jsonb | |
| priority_assets | jsonb | |
| narrative_assessment | text | |
| drift_score | float | 0-1, from sim A4 |
| path_simulation | jsonb | Two paths when fork detected, from sim C3 |
| goals_snapshot | text | |
| created_at | timestamp | |

### TABLE: competitor_signals (from sim A3)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| competitor_name | text | |
| platform | text | |
| signal_type | enum | new_product, viral_post, pricing_change, other |
| summary | text | |
| detected_at | timestamp | |

### TABLE: evergreen_bank (from sim C1)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| asset_id | uuid FK | |
| content | text | |
| platform | enum | |
| approved_at | timestamp | |
| times_used | int | |
| last_used_at | timestamp | |

### TABLE: user_config

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_type | text | service_company, saas_founder, solo_creator, indie_builder |
| goal_statement | text | 90-day goal from onboarding |
| channels | jsonb | Channel registry (platforms, communities, accounts) |
| signal_definitions | jsonb | What Reviewing Agent measures per company type |
| competitors | jsonb | Up to 3 competitors to monitor (optional) |
| silence_threshold_days | int | Default varies by company type (14/10/7/3) |
| burnout_protocol_days | int | Nullable — null means disabled |
| queue_expiry_hours | int | Default 48, auto-adjusted from behaviour (from sim G1) |
| updated_at | timestamp | |

### TABLE: voice_profile_entries

Stores per-platform voice learning signals. Each entry is one data point (approved post, edit diff, skip reason, engagement signal). The Acting Agent queries this table filtered by platform to build few-shot examples and voice constraints.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| platform | enum | reddit, linkedin, twitter, youtube, newsletter, github_readme, hackernews, indiehackers, devto, other |
| entry_type | enum | approved_post, edit_diff, skip_signal, engagement_signal |
| drafted_content_id | uuid FK | Links back to the draft that generated this entry |
| original_content | text | Original draft (for edit_diff type) |
| final_content | text | Approved/edited content |
| diff_categories | jsonb | Categorised changes: tone, structure, content_addition, content_removal, length (from sim D1) |
| skip_reason | enum | Only for skip_signal type |
| engagement_score | float | Normalised engagement for this post (for engagement_signal type) |
| weight | float | Recency-weighted: starts at 1.0, decays over time (from sim D2) |
| created_at | timestamp | Used for recency weighting calculations |

**Design rationale:** A dedicated table (not S3 JSON) because:
- Per-platform filtering is a SQL WHERE clause, not a file-per-platform
- Recency weighting is a query (`ORDER BY created_at DESC` with weight decay), not a rebuild
- Edit diff categories are structured data that need to be aggregated across entries
- The table grows linearly with approvals (~5-15 entries/week), manageable for years
- Acting Agent queries: "Give me the 10 highest-weighted approved posts for LinkedIn" = one indexed query

**Weight decay formula:** `weight = base_weight * (0.95 ^ weeks_since_created)`. Recent entries dominate. Base weight: approved_post = 1.0, edit_diff = 2.0 (edits are the strongest signal), skip_signal = 1.5, engagement_signal = 0.5.

---

## 2. Technical Stack

### Application
- **Framework:** Next.js 14 (App Router), TypeScript throughout
- **Database:** PostgreSQL via Drizzle ORM (Neon Serverless), single schema file
- **Queuing:** SQS (serverless-native, one queue per agent pipeline stage) — no always-on Redis required
- **Long-Running Tasks:** Step Functions to orchestrate Strategist and Reviewing agent runs
- **Voice Transcription:** Whisper API or local Whisper on Apple Silicon

### AI Layer
- **Strategist:** Claude Managed Agents (Anthropic hosted, Opus — highest reasoning quality for strategic thinking)
- **Reviewing:** Claude Managed Agents (Anthropic hosted, Sonnet — signal parsing and summary generation)
- **Noticing:** Sonnet via OpenRouter (quality-first — emotional state detection and nuanced extraction)
- **Acting:** Sonnet via OpenRouter (quality-first — both drafting and confidence scoring as separate calls)
- **Memory:** Postgres-backed via strategist_memory + voice_profile tables. No vector DB in v1.

### Distribution (v1 = Manual Post, Future = Pluggable Auto-Publish)

**v1 approach:** The engine generates platform-structured, ready-to-post content. The human copies and posts manually to the target platform. After posting, the human reports back with the post URL (simple form in approval UI). The engine tracks it as posted_content and the Reviewing Agent collects signals.

**Why manual in v1:** Removes DraftFlow, Reddit .json, and all platform API dependencies from the critical path. The core value is the drafting + strategy loop, not the posting. Manual posting also lets the human make last-second tweaks per platform without the engine needing to handle every platform's API quirks.

**What "platform-structured" means:** Each draft is formatted for its target platform:
- LinkedIn: proper paragraph breaks, no markdown
- Twitter/X: thread-formatted with numbered tweets, character limits respected
- HN: title + URL or text post format
- Reddit: subreddit-appropriate formatting with markdown
- IndieHackers: building-in-public update structure
- Dev.to/Hashnode: full blog post with frontmatter
- Newsletter: email-ready format
- YouTube: script outline or short hook

**Future — pluggable auto-publish/retrieve:**
Each platform becomes a connector plugin with two capabilities:
1. **Publish:** Auto-post approved content directly (replaces manual copy-paste)
2. **Retrieve:** Auto-collect engagement signals (replaces manual URL reporting)

Connectors are built independently. The engine works without any connectors (manual mode) and gets incrementally better as connectors are added.

**Connector types:**
1. **API-based:** Direct platform API integration (Twitter/X API, LinkedIn API, Reddit .json). Fastest, most reliable, but requires API access/keys.
2. **Browser automation:** Headless browser (Playwright/Puppeteer) that automates posting and signal retrieval by interacting with the platform UI. Works for platforms with no public API or restrictive API access. Slower but universal.
3. **Hybrid:** API for retrieval (signals), browser automation for publishing (where API doesn't support it).

Priority connectors: Twitter/X (API), LinkedIn (browser automation — API is restrictive), Reddit (.json for retrieval, browser for posting), HN (browser automation), IndieHackers (browser automation).

### SQS Queues
- **noticing-queue:** processes each brain dump submission
- **acting-queue:** processes each opportunity into drafted content
- **posting-queue:** dispatches approved content
- **reviewing-queue:** weekly cron for signal collection (EventBridge → Step Functions)
- **strategist-queue:** weekly cron + on-demand + quarterly (EventBridge → Step Functions)

---

## 3. Build Order (12 Phases)

| Phase | What | Notes |
|---|---|---|
| 1 | DB Schema | Everything depends on it. Include all sim-added fields + voice_profile_entries + user_config from the start. |
| 2 | Noticing Agent | Simplest agent. Validates core extraction pattern. Include emotional state detection + process-as-content angles. |
| 3 | Acting Agent | Core value. Must include source tag, per-platform voice profile queries, and platform-structured output from day one. |
| 4 | Approval UI + Manual Posting Flow | Source tag + skip reason + edit diff capture required from day one. Manual post reporting (URL input after human posts). |
| 5 | Strategist Agent | Needs signal data. Cannot build meaningfully before posts exist. Weekly + quarterly runs via Step Functions. |
| 6 | Reviewing Agent + Cron | Closes the loop. Signal collection from manually-reported URLs. Include outside-engine audit and business metric correlation. |
| 7 | Voice Input + Whisper | Nice-to-have. Text dump sufficient to validate system. |
| 8 | Launch Mode | Required before any high-stakes launch. Build after core loop is stable. |
| 9 | Burnout Protocol + Evergreen | Required for creator type. Build after Strategist is running. |
| 10 | Platform Connectors (Auto-Publish) | Pluggable. Twitter/X first, then LinkedIn, Reddit. Each connector replaces manual posting for one platform. |
| 11 | Platform Connectors (Auto-Retrieve) | Pluggable. Auto-collect engagement signals instead of manual URL reporting. |
| 12 | Competitor Monitoring | Optional enhancement. Build last. |

> **Key change from original:** DraftFlow and Reddit poster removed as separate phases. v1 uses manual posting with platform-structured output. Auto-publish/retrieve connectors are Phase 10-11, after the core loop is proven.

---

## 4. What Success Looks Like

- **Week 1:** Brain dump -> platform-structured draft generated. Approval UI works with source tag and skip reason. Human manually posts one approved draft and reports URL.
- **Week 2:** Full loop closes. Brain dump → draft → approve → manual post → report URL → signals collected. Zero friction beyond the 3 touch points.
- **Week 4:** Strategist issues first meaningful directives based on real signal.
- **Month 3:** Voice profile strong. Approval rate above 80%. Drafts sound like the human wrote them.
- **Month 6:** Engine surfacing assets the human forgot they built. Distribution happening without thinking about it.
- **Quarter 1:** First quarterly review runs. Drift score computed. Human makes a strategic decision they had been avoiding.

### The Real Test

When you go on a 2-week sprint with zero brain dumps and the engine still posts something reasonable — that is when it is truly alive.

### The Ultimate Test

When the engine tells you that what you want to do is wrong, the data backs it up, and you listen. That is when it has earned the title of a living engine.
