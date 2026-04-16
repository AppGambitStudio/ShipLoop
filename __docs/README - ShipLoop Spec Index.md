# ShipLoop — Product Specification Index

**A Living Distribution Engine for Builders**

Spec v1.0 — AppGambit

---

## Folder Structure

### 01 — Vision and Problem
1. Vision
2. Core Problem Profile
3. What Makes It a Living Engine (with per-type examples for all 4 company types)

### 02 — Agent Architecture
1. Agent Architecture (all 4 agents with per-company-type behaviour including Indie Builder)
   - Process-as-content extraction in Noticing Agent
2. Human Interaction Design (3 touch points)
3. Special Modes (Burnout Protocol, Launch Mode)
4. Agentic Patterns Used (8 patterns)
5. Error States and Recovery

### 03 — Company Types
1. Four Company Types overview
2. Software Consulting/Service Company (day-to-day, voice, anti-patterns)
3. SaaS/Product Company (day-to-day, voice, funnel mapping)
4. Solo Creator/Educator (day-to-day, voice, burnout risk)
5. Indie Builder / Building in Public (day-to-day, voice, pre-launch vs post-launch)
6. Fixed vs Configurable
7. Onboarding as Configuration (with guided goal statement)
8. Multi-User Path (v1 = single user, future = team)
9. Cross-Type Strategist Comparison (4-column)

### 04 — Simulations
**04A — Original Simulations:**
- A: Software Consulting/Service — Daily / Monthly / Yearly
- B: SaaS/Product — Daily / Monthly / Yearly
- C: Solo Creator/Educator — Daily / Monthly / Yearly
- Consolidated Refinements Table (10 refinements)

**04B — Supplementary Simulations:**
- D: Voice Profile Learning Curve
- E: Strategist Failure and Stale Directives
- F: Messy Input
- G: Queue Neglect
- Supplementary Refinements Table (10 refinements)

### 05 — Technical Spec
1. Data Architecture (full PostgreSQL schema, 10 tables, expanded platform enum)
2. Technical Stack (SST v4, Neon, SQS, Sonnet/Opus, Managed Agents)
3. Build Order (12 phases)
4. What Success Looks Like

### 06 — Cost Analysis
1. ShipLoop monthly cost breakdown (AI + infrastructure)
2. Full-time person cost (India, by role level)
3. Side-by-side comparison (15-25x cost advantage)
4. What ShipLoop does NOT replace
5. Cost scaling by usage level

### 07 — AI Patterns
1. Pattern taxonomy (zero-shot, few-shot, review-and-regenerate, multi-step agent, tool-using agent, external API)
2. Complete touchpoint mapping (13 touchpoints across 6 patterns)
3. Summary by pattern
4. Prompt assembly complexity
5. Failure modes and graceful degradation

### 08 — Market Research
1. Direct competitors (6 products with pricing and gap analysis)
2. Adjacent competitors (schedulers, AI writing, LinkedIn/Twitter tools, newsletters, repurposing)
3. Failed products (5 shutdowns with lessons)
4. Market size and demand (creator economy, SMB content spend, indie dev pain points)
5. User psychology and trust (trust gap, uncanny valley, voice matching reality)
6. Pricing and willingness to pay (competitive landscape, pricing recommendation)
7. Distribution channels for ShipLoop itself (PH, HN, IndieHackers, Reddit, build-in-public)
8. Strategic synthesis (gap analysis, moat assessment, critical risks)

### ShipLoop-TechImpl-v1
Implementation-level technical specification: SST v4 Ion, Drizzle schema, Step Functions, Claude Managed Agents, SQS queues.

---

**STATUS:** v1.0 spec complete. 4 company types. Ready for build planning.
