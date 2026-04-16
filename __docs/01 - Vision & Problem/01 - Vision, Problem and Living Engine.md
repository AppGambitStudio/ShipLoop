# SHIPLOOP — Vision, Problem and Living Engine

Spec Section 01 — Detailed

---

## 1. VISION

ShipLoop is not a content scheduler. Not a social media manager. Not a dashboard you have to remember to open.

ShipLoop is a **living engine** — an autonomous, AI-native system that thinks about your distribution so you don't have to. It runs on its own cadence. It has memory, opinion, and rhythm. When you go quiet, it doesn't stop. It adapts.

### North Star

You register an asset. The engine takes it from there. Your only job is a daily 2-minute brain dump and occasional approvals. Everything else is automated.

### The Mental Model Shift

Most tools work like this:

```
Old: You → Input → System → Output
     (You drive. System responds. You forget. Nothing happens.)
```

ShipLoop works like this:

```
New: Engine runs continuously.
     You dip in and out.
     Engine adjusts to your presence AND your absence.
     When you disappear for a week, it doesn't stop — it shifts strategy.
```

The difference is agency. A scheduler waits for you. ShipLoop doesn't wait. It has its own sense of what should happen next, informed by everything it has seen you do, every signal it has collected, and every pattern it has learned.

### What ShipLoop Is NOT

To be precise about boundaries:

- **Not a content calendar.** There is no grid of pre-scheduled posts. The engine decides what to post and when based on live context.
- **Not a social media management tool.** It doesn't manage accounts, moderate comments, or handle DMs. It handles distribution — getting your work in front of the right people.
- **Not a copywriting tool.** It doesn't generate marketing fluff. It takes real things you've built and shipped, and translates them into distribution-ready content in your voice.
- **Not a monitoring/listening tool.** It doesn't crawl the internet watching for mentions. You are the sensor. You tell it what happened. It figures out what to do with that information.
- **Not a CRM or pipeline tool.** It doesn't track leads or send follow-ups. But it feeds the top of whatever funnel you already have.

---

## 2. CORE PROBLEM PROFILE

### Who This Is For

This product is built for a specific type of person:

- **Technically strong, building real things.** From indie devs shipping a side project to teams that have delivered dozens of client projects. They have work — shipped or in progress — that deserves distribution.
- **Distribution is inconsistent, reactive, and always the last priority.** They post when they remember. They post when something feels big enough. They don't post the smaller wins that actually compound over time.
- **Has proof of work scattered everywhere but no system pulling it together.** GitHub repos with no README distribution. Client projects that never became case studies. Talks that were never repurposed. Products that shipped quietly. Building-in-public threads that started strong and fizzled after 2 weeks.
- **Not lazy — optimising for building over broadcasting.** They aren't bad at distribution because they lack discipline. They're bad at it because every hour spent on distribution feels like an hour stolen from building. And they're right — until the loop is automated.
- **Loses momentum because there is no defined "done" state for distribution.** You ship a feature — that's done. You close a client project — that's done. But "distribute your work" is never done. It's an open-ended, guilt-inducing task with no completion signal. So it gets deprioritised indefinitely.

### Why This Is Hard

What makes this hard is not motivation. It's architecture. The problem is structural:

1. **No capture mechanism.** Things worth distributing happen throughout the day. By the time you sit down to write about them, the context and energy are gone.
2. **No translation layer.** Even when something is captured, turning "I shipped X" into a LinkedIn post or a Reddit thread or a newsletter update requires a different kind of thinking. Builders think in features and architecture. Distribution requires thinking in audience and angle.
3. **No feedback loop.** Even when something gets posted, the signal from that post (what worked, what didn't, what resonated) doesn't feed back into future decisions. Every post is a one-off. There's no compounding.
4. **No persistence.** If you go dark for a week, nothing compensates. There's no system maintaining presence while you're heads-down building.
5. **No opinion.** Existing tools do what you tell them. None of them tell you "hey, you haven't distributed CloudCorrect in 3 weeks despite it being your highest-traction asset." There's no pushback, no strategic thinking happening on your behalf.

### The Fix

Make distribution:
- **Completable** — one brain dump and one approval session per day. That's it. Done.
- **Trackable** — every asset has a distribution status. Nothing falls through the cracks.
- **Signal-driven** — what got traction influences what happens next. The loop compounds.
- **Automated** — the entire pipeline from brain dump to posted content runs without you touching it beyond approval.

Then automate the entire loop so the human only touches it at the edges.

---

## 3. WHAT MAKES IT A LIVING ENGINE

Five properties that separate ShipLoop from a workflow, a script, or a "smart scheduler."

### 3.1 Memory

**What it means:** The engine knows what happened before, not just what is happening now. Every action, signal, and outcome is retained and influences future behaviour.

**In practice:**

- It knows that CloudCorrect was your highest-traction asset 6 weeks ago but hasn't been distributed since.
- It knows that your last 3 Reddit posts in r/SideProject got moderate engagement but your r/devops posts got strong engagement — so it shifts channel weighting.
- It knows that the LinkedIn post about your AWS re:Invent talk drove 4 CTO connection requests, so next time you have a speaking engagement, it knows the angle that works.
- It knows you skipped the last 3 drafts tagged "thought leadership" with the reason "tone wrong" — so it stops generating that angle.

**What this is NOT:** A static log or analytics dashboard. Memory is active — it changes what the engine does next. A dashboard shows you data. Memory uses that data to make different decisions without being told.

**Per company type:**

| Company Type | Memory focuses on |
|---|---|
| Software Consulting/Service | Narrative arcs — which client stories, tools, and talks have been distributed and how they connect to the positioning thesis |
| SaaS/Product | Funnel performance — which content types drive trials vs which drive engagement-without-conversion |
| Solo Creator/Educator | Cadence patterns — audience expectations, format performance, seasonal patterns in subscriber behaviour |
| Indie Builder | Momentum patterns — which building-in-public updates get traction, what milestones resonate, where the audience is most engaged |

### 3.2 Opinion

**What it means:** The engine doesn't just execute. It pushes back. It surfaces what you're missing. It tells you things you don't want to hear.

**In practice:**

- Monday morning, before you've said anything, it already has an assessment: "Your last 3 weeks of content have been about AI document processing. You haven't mentioned your cloud infrastructure work at all. Your positioning is drifting from 'cloud + AI execution' to just 'AI tooling.' This weakens the narrative for enterprise clients who need both."
- When you submit a brain dump saying "Need to post more, feeling behind" during a stressful week, it doesn't just generate 10 drafts. It flags: "Stress detected in input. Your last panic-posting session produced 4 posts with below-average engagement. Recommend maintaining normal cadence."
- When you've been ignoring a high-priority asset for weeks, it puts it back in the queue with increasing urgency — not because you asked, but because the data says you should.

**What this is NOT:** A yes-machine that does whatever you tell it. The Strategist agent has its own assessment of what the right thing to do is, based on accumulated data. It can disagree with you. The human always has final say (approval is never bypassed), but the engine's opinion is always visible.

**Per company type:**

| Company Type | Opinion sounds like |
|---|---|
| Software Consulting/Service | "Your last 10 posts don't collectively tell one story. Three are about AI, four about cloud, three about process. The CTO who visits your profile sees fragmentation, not expertise." |
| SaaS/Product | "Your most-engaged content (technical threads) drives 0.2% trial conversion. Your least-engaged content (problem-solution case studies) drives 3.1% trial conversion. You're optimising for applause, not pipeline." |
| Solo Creator/Educator | "You've been silent for 4 days. Your audience expects 3x/week minimum. Here are 3 drafts from your recent comments section that could go out today — approve one." |
| Indie Builder | "You've been building for 2 weeks without sharing anything. Your last 'shipped X' post got 3x engagement of your metrics updates. You have uncommonly interesting debugging stories — share the Stripe webhook saga." |

### 3.3 Rhythm

**What it means:** The engine breathes on its own cadence. Daily intake. Immediate processing. Weekly reflection. Quarterly strategy review. It doesn't wait for you to remember.

**In practice:**

The engine has a heartbeat:

- **Daily (always):** Processes any brain dump within minutes. Drafts ready in approval queue by the time you check.
- **Daily (if silent):** After the silence threshold (varies by company type), begins surfacing fallback content from Strategist directives or the evergreen bank.
- **Weekly (Sunday night):** Reviewing agent collects signals from all posts. Produces a single summary. Strategist runs and issues directives for the next week.
- **Quarterly:** Strategist compares the last 90 days against the original goal statement. Computes a drift score. If a strategic fork is detected, presents two simulated paths.
- **On-demand:** Strategist can be triggered manually when something significant happens (competitor launch, major win, strategic shift).

**What this is NOT:** A cron job that fires blindly. Rhythm is context-aware. If you've been submitting rich brain dumps every day, the weekly review is about optimising. If you've been silent for a week, the weekly review is about compensating. Same schedule, different behaviour.

**Per company type:**

| Company Type | Rhythm character |
|---|---|
| Software Consulting/Service | Slow and steady. 1-2 strong posts per week. Weekly review focuses on narrative coherence across the last 10 posts. |
| SaaS/Product | Consistent drumbeat. 3-5 posts per week across channels. Weekly review focuses on funnel metrics and channel performance. |
| Solo Creator/Educator | High-frequency presence. Daily or near-daily. Weekly review focuses on subscriber growth rate and audience sentiment. |
| Indie Builder | Burst-and-quiet pattern. High activity around milestones, quiet during build sprints. Weekly review focuses on momentum narrative and community engagement. |

### 3.4 Adaptation

**What it means:** What worked last month changes how the engine behaves this month. Signal feeds strategy. Strategy feeds execution. The loop compounds.

**In practice:**

- Month 1: Engine posts evenly across LinkedIn, Reddit, and Twitter. Engagement data starts coming in.
- Month 2: Strategist sees that LinkedIn drives 4x the right-audience engagement. Directive: increase LinkedIn weight to 60%, reduce Twitter to 15%.
- Month 3: Within LinkedIn, "proof of execution" posts (showing actual output) outperform "insight" posts by 3x. Acting Agent adjusts default angle for LinkedIn drafts.
- Month 4: A new pattern emerges — posts that reference a specific client outcome (anonymised) drive the most CTO connection requests. Strategist adds "client outcome angle" to the directive with highest priority.
- Month 6: The engine's output looks nothing like Month 1. Not because someone reconfigured it, but because it learned.

**What this is NOT:** A static ruleset. The engine doesn't have fixed rules like "post on LinkedIn on Tuesdays." It has a learning loop where every signal updates the strategy, and every strategy update changes execution.

**The compounding effect:**

```
Brain Dump → Noticing → Acting → Posting → Signal → Reviewing → Strategist → Directives
                                                                                   ↓
                                                     Noticing (next run, better context)
                                                                                   ↓
                                                        Acting (next run, better voice)
                                                                                   ↓
                                                                    Better output. Repeat.
```

Each cycle, the engine gets marginally better at: extracting the right opportunities, drafting in the right voice, choosing the right channels, and prioritising the right assets.

### 3.5 Personality

**What it means:** The engine feels like a thinking collaborator, not a task runner. It has a point of view. It has a tone. Monday morning, it already knows what the week should look like — before you say anything.

**In practice:**

The Strategist's internal monologue is the personality layer. It's not a formal report — it's the engine thinking out loud:

> Week 3: "Builder is in high-shipping, low-distribution phase. This happens every time a big client sprint hits. Don't push for new content. Instead, compensate by resurfacing older high-signal assets with new angles. The CloudCorrect deep-dive from Week 1 still has legs — try a 'one month later' angle."

> Week 6: "DocProof and CloudCorrect account for 80% of traction. IPOIQ has never been properly distributed despite being technically impressive. Something is off — either the positioning is wrong or we haven't found the right audience. Priority shift: force IPOIQ into the pipeline over the next 2 weeks with experimental angles. If it doesn't land in 3 attempts, deprioritise and log the lesson."

> Week 12: "Quarterly check. Original goal: 'Be known as the team that ships cloud + AI tools, not just talks about them.' Drift score: 0.3 (moderate). Last month had too many 'insight' posts and not enough 'proof' posts. The narrative is sliding from 'we build' to 'we think.' Course correction needed."

**What this is NOT:** A chatbot personality or a branded voice. The personality isn't customer-facing. It's internal — the engine reasoning about what it should do and why, in a way that makes its decisions transparent and auditable by the human.

---

## 4. WHAT THIS DOCUMENT DOES NOT COVER

The following are defined in separate spec sections:

- **Agent Architecture** (how the 4 agents work in detail) → Section 02
- **Company Type Analysis** (detailed per-type configuration) → Section 03
- **Simulations** (daily/monthly/yearly stress tests per company type) → Section 04
- **Technical Spec** (data architecture, tech stack, build order) → Section 05
