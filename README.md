# ShipLoop

**You ship. We broadcast.**

Your AI distribution assistant. It captures signal from work you're already doing, figures out what's worth broadcasting, and puts it in the right place at the right time — in your voice.

---

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 20+
- An [OpenRouter](https://openrouter.ai/) API key

### 1. Clone and configure

```bash
git clone <repo-url> shiploop && cd shiploop
cp .env.example .env
```

Edit `.env` and add your keys:
```
OPENROUTER_API_KEY=sk-or-...        # Required — powers Noticing + Acting agents
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514  # Change to any OpenRouter model
ANTHROPIC_API_KEY=sk-ant-...         # Required later for Strategist (Phase 2)
JWT_SECRET=any-random-string-at-least-16-chars
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Start the backend

```bash
cd backend
npm install
npx drizzle-kit push    # Creates all tables on first run
npm run dev             # Starts Fastify on http://localhost:3001
```

Verify: `curl http://localhost:3001/health` should return `{"status":"ok",...}`

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev             # Starts Next.js on http://localhost:3000
```

### 5. Use it

1. Open http://localhost:3000
2. Register an account
3. Submit a brain dump — type what you shipped today
4. Wait ~30 seconds for the AI pipeline to process
5. Check the Approval Queue — review, edit, or skip the generated drafts

### Stopping everything

```bash
# Frontend: Ctrl+C in the frontend terminal
# Backend: Ctrl+C in the backend terminal
docker compose down     # Stops Postgres (data persists in Docker volume)
```

### Resetting the database

```bash
docker compose down -v  # Removes the volume — all data deleted
docker compose up -d
cd backend && npx drizzle-kit push
```

---

## What's Built (Phase 1)

| Component | Status | Description |
|---|---|---|
| Database | Done | PostgreSQL with 11 tables (Drizzle ORM) |
| Auth | Done | Register + login + JWT middleware |
| Brain Dump API | Done | POST /api/dumps → async pipeline |
| Noticing Agent | Done | Extracts opportunities from brain dumps via AI |
| Acting Agent | Done | Drafts platform-specific content + confidence scoring |
| Approval Queue API | Done | Approve / edit / skip with voice profile learning |
| Frontend | Done | Login, brain dump input, approval queue with draft cards |

## What's Next (Phase 2+)

- Strategist Agent (Claude Managed Agents — weekly strategy + quarterly reviews)
- Reviewing Agent (signal collection from posted content)
- Weekly summary generation
- Voice input (Whisper)
- Platform connectors (auto-publish / auto-retrieve)

---

## Product Vision

ShipLoop is an AI-native system that handles distribution so builders don't have to. It's not a content scheduler or social media manager — it's an autonomous engine with memory, opinion, and rhythm that runs on its own cadence, adapts to your presence and absence, and learns your voice over time.

## The Problem

Technically strong people — indie devs, SaaS founders, consulting teams, educators — ship real things but are inconsistent at distribution. The problem isn't motivation, it's architecture:

- No capture mechanism (context and energy gone by the time you sit down to write)
- No translation layer (builders think in features, distribution requires audience + angle)
- No feedback loop (every post is a one-off, no compounding)
- No persistence (go dark for a week, nothing compensates)
- No opinion (no tool tells you what you're missing)

## How It Works

**You do 3 things. The engine does everything else.**

1. **Daily brain dump** (2 min) — text or voice, stream of consciousness, no structure needed
2. **Approval queue** (5-10 min) — review AI-drafted content cards, approve/edit/skip
3. **Weekly summary** (5 min passive read) — what worked, what didn't, what's next

The engine processes your brain dump, extracts distribution opportunities, drafts platform-specific content in your voice, queues it for approval, and after you post, collects signals that feed back into the strategy. Every cycle, it gets better.

## Four Company Types

ShipLoop adapts to how you work:

| Type | Sells | Distribution character |
|---|---|---|
| **Software Consulting/Service** | Expertise | Narrative coherence — last 10 posts tell one story |
| **SaaS/Product** | Product | Funnel-feeding — awareness → education → conversion |
| **Solo Creator/Educator** | Trust | Cadence — never go dark, presence is the product |
| **Indie Builder (Building in Public)** | The journey | Momentum — struggles + wins, the process IS the content |

## AI Architecture

ShipLoop is AI-intensive. Four agents in a hierarchy, each with a distinct role:

```
                    ┌─────────────────┐
                    │   STRATEGIST    │  ← The brain. Reasons over weeks of data.
                    │   (Opus)        │
                    └────────┬────────┘
                             │
                    Directives (JSON)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌─────────────┐
     │  NOTICING  │  │   ACTING   │  │  REVIEWING  │
     │  (Sonnet)  │→ │  (Sonnet)  │  │  (Sonnet)   │
     └────────────┘  └────────────┘  └─────────────┘
```

### Where AI Sits in the Pipeline

| Touchpoint | Agent | Model | What It Does |
|---|---|---|---|
| Brain dump processing | Noticing | Sonnet | Extracts structured opportunities from messy text. Detects emotional state. Classifies process-as-content angles (struggles, decisions, milestones). |
| Content drafting | Acting (call 1) | Sonnet | Drafts platform-structured content using per-platform voice profile (few-shot examples from approved history). |
| Confidence scoring | Acting (call 2) | Sonnet | Evaluates the draft in a separate call — voice match, angle fit, quality, directive alignment. Scores 0-1. |
| Edit diff analysis | Acting (post-approval) | Sonnet | Categorises what the human changed: tone, structure, content addition/removal, length. Feeds voice profile. |
| Signal parsing | Reviewing | Sonnet | Parses raw engagement data into structured metrics. Detects trends. Benchmarks per-platform. |
| Weekly summary | Reviewing | Sonnet | Generates a human-readable narrative from structured data — not a dashboard, a message with business outcome correlation. |
| Strategic reasoning | Strategist | Opus | Reasons over 30-90 days of data. Updates internal monologue. Issues directives. Detects narrative drift. Presents path simulations at forks. |
| Emotional fast-check | Strategist (light) | Sonnet | Focused "should we change anything?" when critical emotional state is flagged. |
| Voice transcription | Whisper | Whisper | Converts voice note brain dumps to text. |
| Signal scraping (v1.5) | MCP Browser Agent | Browser automation | Visits reported post URLs and extracts publicly visible engagement data. |

### Key AI Engineering Challenges

**Prompt design is the real engineering work.** Each AI touchpoint needs a carefully designed system prompt, structured output schema (Zod-validated), and per-company-type context injection. The Noticing Agent's prompt for an indie builder is fundamentally different from one for a consulting company — same extraction logic, different directives.

**Voice profile as context engineering.** The Acting Agent dynamically assembles its prompt from: the opportunity, the platform's top 10 recency-weighted examples from `voice_profile_entries`, current Strategist directives, and "what to avoid" patterns from recent skips. This is a non-trivial prompt construction pipeline that changes with every approval.

**The Strategist is a reasoning agent, not a single LLM call.** It runs as a Claude Managed Agent session via Step Functions — reading its own prior monologues, querying Postgres via custom tools, reasoning about what changed over weeks of accumulated context, and writing structured directives. This justifies Opus and the long-running session architecture.

**Separation of drafting and scoring.** The Acting Agent drafts and scores in separate LLM calls. Same model (Sonnet), different system prompts. The scorer evaluates work it didn't produce — preventing confidence inflation and catching quality issues the drafter can't see.

**The voice profile compounds.** Every approval, edit, skip, and engagement signal feeds back into the voice profile with recency weighting (5% decay per week). Edit diffs are the strongest signal (weight 2.0). By Month 3, approval rate should exceed 80%. By Month 6, the engine sounds like you.

## Build Order

| Phase | What |
|---|---|
| 1 | DB Schema (10 tables, all simulation-derived fields from day one) |
| 2 | Noticing Agent (extraction + emotional state + process-as-content) |
| 3 | Acting Agent (voice profiles, platform-structured output, confidence scoring) |
| 4 | Approval UI + Manual Posting Flow |
| 5 | Strategist Agent (weekly + quarterly) |
| 6 | Reviewing Agent + Cron (signal collection, outside-engine audit) |
| 7 | Voice Input (Whisper) |
| 8 | Launch Mode |
| 9 | Burnout Protocol + Evergreen Bank |
| 10 | Platform Connectors — Auto-Publish |
| 11 | Platform Connectors — Auto-Retrieve |
| 12 | Competitor Monitoring |

## Spec Documentation

Full product specification in `.docs/`:

| Doc | Contents |
|---|---|
| 01 — Vision & Problem | Vision, problem profile, 5 living engine properties |
| 02 — Agent Architecture | 4 agents, pipeline, human interaction, agentic patterns, error recovery |
| 03 — Company Types | 4 types with day-to-day examples, voice profiles, onboarding, multi-user path |
| 04 — Simulations | 13 scenarios, 20 refinements with priority tiers |
| 05 — Technical Spec | Schema, tech stack, build order, success criteria |
| TechImpl-v1 | Implementation-level: SST config, Drizzle schema, Step Functions, Managed Agents |

---

Built by [AppGambit](https://appgambit.com)
