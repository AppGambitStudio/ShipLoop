# ShipLoop

**You ship. We broadcast.**

Your AI distribution assistant. It captures signal from work you're already doing, figures out what's worth broadcasting, and puts it in the right place at the right time — in your voice. You never stop building.

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)

---

## What is ShipLoop?

Broadcasting is a tax builders keep failing to pay. Not because they're lazy — because every hour on distribution is an hour stolen from building.

ShipLoop removes the friction. You dump what you shipped today in 2 minutes. The engine extracts what's worth sharing, drafts platform-specific content in your voice, and nudges you to approve. You stay in control. It handles the heavy lifting.

**What it is NOT:** A content scheduler. A social media manager. A copywriting tool. An auto-poster.

**What it IS:** A dedicated AI assistant that learns your voice over time, thinks strategically about your distribution narrative, and gets better with every approval, edit, and skip.

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 20+
- [OpenRouter](https://openrouter.ai/) API key (for content generation)
- [Anthropic](https://console.anthropic.com/) API key (for Strategist agent)

### 1. Clone and configure

```bash
git clone https://github.com/aspect-apps/shiploop.git && cd shiploop
cp .env.example .env
```

Edit `.env`:
```
OPENROUTER_API_KEY=sk-or-...        # Powers Noticing + Acting agents
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
ANTHROPIC_API_KEY=sk-ant-...         # Powers Strategist agent (Managed Agents)
JWT_SECRET=any-random-string-at-least-16-chars
```

### 2. Start Postgres

```bash
docker compose up -d
```

### 3. Start the backend

```bash
cd backend
npm install
npx drizzle-kit push    # Creates all tables on first run
npm run dev
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Use it

1. Open the frontend URL shown in terminal
2. Register → complete onboarding (company type, goal, channels)
3. Add your assets (shipped projects, tools, content)
4. Submit a brain dump — type what you shipped today
5. Check the Approval Queue — approve, edit, or skip drafts
6. Run the Strategist for weekly analysis

---

## Architecture

ShipLoop uses a mix of AI patterns — not everything is an "agent." Only the Strategist is a true agent (multi-step reasoning with tools and memory). The rest are focused LLM workflows.

```
Brain Dump (2 min)
     ↓
[NOTICING] — single LLM call: extracts opportunities, detects emotional state
     ↓
[ACTING] — two LLM calls: draft content + score quality (separate calls)
     ↓
Approval Queue — approve / edit / skip (each action trains voice profile)
     ↓
[STRATEGIST AGENT] — multi-step agent: reads data via tools → reasons → writes directives
     ↓
Better drafts next cycle (the loop compounds)
```

### AI Components

| Component | Pattern | How it runs |
|---|---|---|
| **Strategist** | **Agent** (loop + tools + memory) | Claude Managed Agents session. Calls 7 custom tools to read/write Postgres. Reasons over weeks of data. The only true agent. |
| **Noticing** | LLM workflow (zero-shot, single call) | One call to OpenRouter. Input: brain dump + context. Output: structured JSON. No tools, no memory, no loop. |
| **Acting** | LLM workflow (few-shot, two calls) | Draft call + separate scoring call via OpenRouter. Assembles voice profile as few-shot context. No loop. |
| **Edit Diff Analysis** | LLM workflow (zero-shot, single call) | Categorizes what the user changed. Fires after edit+approve. |
| **Reviewing** | LLM workflow (planned) | Will parse engagement data and generate weekly summary. Single call. |

### Four Company Types

| Type | Distribution character | Silence threshold |
|---|---|---|
| **Service Company** | Narrative coherence — last 10 posts tell one story | 14 days |
| **SaaS / Product** | Funnel-feeding — awareness → education → conversion | 7 days |
| **Solo Creator** | Never go dark — presence is the product | 3 days |
| **Indie Builder** | The process IS the content — struggles + wins | 10 days |

### Voice Profile Learning

Every interaction trains the engine:
- **Approve** (weight 1.0) — "more like this"
- **Edit** (weight 2.0) — strongest signal, AI categorizes what you changed
- **Skip** (weight 1.5) — "don't do this again" with reason
- **Engagement** (weight 0.5) — what the audience responded to

Profiles are per-platform with recency weighting (5% decay/week). Week 1: generic drafts. Month 3: sounds like you.

## Why Claude Managed Agents for the Strategist?

The Strategist is the only true agent in ShipLoop. Noticing and Acting are LLM workflows — input in, output out. The Strategist needs to **reason across multiple data sources, decide which data to read based on what it finds, and produce structured decisions**. That's an agent problem, not a prompt problem.

We evaluated three approaches:

| Approach | Pros | Cons |
|---|---|---|
| **Single LLM call** (dump all data into one prompt) | Simple, fast | Context window limits at scale. Can't read data conditionally. No tool use. |
| **Custom agent loop** (build our own tool-calling loop) | Full control | We'd build what Anthropic already built — tool execution, state management, retries, compaction. Maintenance burden. |
| **Claude Managed Agents** | Managed infrastructure, built-in tool execution, persistent sessions, automatic compaction | Beta API. Vendor dependency. Opus cost. |

We chose Managed Agents because:

1. **The Strategist's job is open-ended reasoning.** It reads its own prior monologues, cross-references posts against approval patterns, and detects narrative drift. That reasoning path isn't predictable — the agent needs to decide which tools to call and in what order based on what it finds. A single prompt can't do this well.

2. **Custom tools keep our data local.** The agent runs in Anthropic's cloud but can only access our Postgres through 7 custom tools we defined. It can't run bash, read files, or access the network. We control exactly what data it sees and what it can write.

3. **We don't want to maintain an agent runtime.** Tool execution, error recovery, context compaction, heartbeating — Managed Agents handles all of this. We focus on the tools and the prompt, not the infrastructure.

4. **The operational agents stay on OpenRouter.** Only the Strategist uses Managed Agents (and Opus). Noticing, Acting, and Reviewing use OpenRouter with configurable models. This keeps operational costs low while giving the Strategist the reasoning depth it needs.

**Trade-off acknowledged:** Managed Agents is in beta. If the API changes or pricing becomes prohibitive, we can fall back to a custom agent loop using the same tool handlers — they're just Postgres queries. The tools are the stable interface; the runtime is swappable.

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Fastify, TypeScript |
| Frontend | Next.js 14, Tailwind CSS |
| Database | PostgreSQL 16 (Docker), Drizzle ORM |
| AI (operational) | OpenRouter (configurable model) |
| AI (strategic) | Anthropic Claude Managed Agents |
| Auth | JWT (database-backed, designed for future Cognito swap) |

## What's Built

| Component | Status |
|---|---|
| Database (12 tables) | Done |
| Auth (register + login + JWT) | Done |
| Brain dump pipeline (Noticing + Acting) | Done |
| AI retry with JSON validation | Done |
| Approval queue (approve/edit/skip) | Done |
| Edit diff analysis | Done |
| Voice profile tracking | Done |
| Strategist Agent (Managed Agents) | Done |
| Assets management | Done |
| Onboarding wizard | Done |
| Posted content tracking | Done |

## What's Next

- Reviewing workflow (signal collection)
- Weekly summary generation
- Voice input (Whisper)
- Voice profile aggregation (distilled summaries at scale)
- Platform connectors (auto-publish / auto-retrieve)
- Burnout protocol + evergreen bank

## Documentation

Full product specification in `__docs/`:

| Doc | Contents |
|---|---|
| 01 — Vision & Problem | Living engine concept, 5 core properties |
| 02 — Agent Architecture | 4 agents, pipeline, human interaction, error recovery |
| 03 — Company Types | 4 types, onboarding, multi-user path |
| 04 — Simulations | 13 scenarios, 20 refinements |
| 05 — Technical Spec | Schema, stack, build order |
| 06 — Cost Analysis | ShipLoop vs full-time person (INR) |
| 07 — AI Patterns | 13 touchpoints, 6 patterns |
| 08 — Market Research | Competitors, demand, pricing, risks |

AI viability tests in `__tests/`:
- Voice profile (few-shot + review-and-regenerate)
- Strategist reasoning (multi-step agent with tools)
- Noticing extraction (zero-shot accuracy)
- Confidence calibration (score correlation)

## License

[MIT](LICENSE) — Built by [AppGambit](https://appgambit.com)
