# SHIPLOOP — Simulations and Consolidated Refinements

Spec Section 04A — Original Simulations

**Purpose:** Stress-testing the engine across real conditions. 9 simulations across 3 company types, 3 time horizons each. Each surfaces gaps and required refinements.

---

## Simulation Set A: Software Consulting/Service Company

### A1. Daily

**Day 1 — Normal Hit**

Input: "Shipped CloudCorrect v2. 65 AWS checks. 12 services. MIT licensed."

Noticing: 3 opportunities — launch, technical deep-dive, OSS community drop.

Acting: LinkedIn outcome-first post + Reddit setup walkthrough. Confidence 0.91.

Approval: LinkedIn approved as-is. Reddit edited. Both posted.

Outcome: 340 LinkedIn impressions. 4 CTO connection requests. 180 Reddit upvotes.

Engine: Strategist promotes CloudCorrect to priority for 3 weeks.

**Day 2 — Miss: No Brain Dump**

Input: None. Deep client sprint.

Engine: Detects 24h silence. Surfaces CloudCorrect with unused re-angle. Pre-drafts from Strategist fallback.

Gap found: Fallback drafts not labelled — human doesn't know why they appeared.

> **REFINEMENT A1:** Add source tag to every card: Brain Dump / Strategist Fallback / Signal Amplification.

**Day 3 — Miss: Wrong Tone Draft**

Input: "Great client call about AI document processing. They saved 3 days of manual work."

Draft: "Excited to share how AI is transforming document processing!" — marketing tone. Confidence 0.72.

Human skips. No reason given.

Gap found: Silent skip is wasted signal. Engine repeats the mistake.

> **REFINEMENT A2:** One-tap skip reason: Tone wrong / Angle wrong / Timing wrong / Too generic. Feeds voice profile.

### A2. Monthly

**Month 2 — Win: Narrative Compounds**

14 posts published. Posts siloed by tool. No cross-asset narrative.

Strategist directive: prioritise cross-asset posts for 2 weeks.

Outcome: Highest engagement post. 3 inbound enquiries reference it specifically.

Engine logs: "Cloud-first-then-AI is the positioning thesis. Reinforce every 3 weeks."

**Month 4 — Shock: Competitor Launches Same Tool**

Event: Competing consultancy releases near-identical CloudCorrect clone with traction.
Human: "Someone just launched exactly what we built. Not sure how to react."

Noticing: Detects competitive event + emotional state. Flags to Strategist first.

Strategist: Does not panic-post. Directive: depth-over-breadth. India-specific checks. Client outcomes. Things competitor cannot replicate.

Gap found: Engine cannot detect competitor activity independently.

> **REFINEMENT A3:** Optional competitor monitoring in onboarding. Reviewing Agent scrapes weekly.

### A3. Year-Long: Identity Drift

Month 1-3: Coherent narrative. Inbound leads growing.

Month 4-6: Big non-technical project won. Brain dumps shift to process consulting. Acting Agent follows.

Month 7: Strategist detects drift. "Cloud + AI narrative weakened significantly. 3 posts in a row with no technical proof."

Month 8: Directive: 2-week asset revival. Resurface technical posts. Halt consulting drafts.

Month 9-10: Human accepts correction. Technical narrative resumes. Right inbound returns.

Year-end: Drift identified and corrected at Month 7. Without engine, would have continued undetected.

> **REFINEMENT A4:** Quarterly narrative review. Compares 90 days against original goal statement. Outputs drift score.

---

## Simulation Set B: SaaS/Product Company

### B1. Daily

**Day 1 -- Hit: Feature Launch**

Input: "Shipped bulk CSV export. Users asked for it for 3 months."

Acting: Twitter thread problem-first. Reddit how-it-was-built. LinkedIn user impact.

Outcome: Twitter 180 retweets, 3 journalist DMs. Reddit 240 upvotes. Two churned users email asking to resubscribe.

Engine: Adds churn recovery as new signal category.

**Day 4 -- Miss: Emotional Post Outside Engine**

Event: Competitor gets unfair press. Founder posts emotional Twitter response directly.

Engine: Has no visibility. Post gets ratioed. Brand damaged for a week.

Gap found: No guardrail for posts made outside the system.

> **REFINEMENT B1:** Weekly summary includes Outside Engine audit. Flags manual posts, assesses brand impact.

### B2. Monthly

**Month 3 -- Shock: Product Hunt Launch Day**

Problem: Brain dump -> draft -> approve -> post is too slow for PH day. Responses need minutes not hours.

Gap found: No launch day mode. Normal cadence breaks under real-time pressure.

> **REFINEMENT B2:** Launch Mode. Manually activated. Noticing monitors every 30 minutes. Acting pre-drafts 10-15 response templates. Approval UI in rapid-fire mode. Auto-deactivates after 24 hours.

### B3. Year-Long: Content Without Conversion

Month 1-4: Good engagement. Trial signups flat. Founder happy with traction. Business not growing.

Month 5: Strategist quarterly: high-engagement posts attract learners not buyers. Low-engagement product-linked posts drive more trials.

Month 6: Directive shift - 40% conversion content. Founder resists - feels inauthentic.

Tension: Genuine conflict. Engine surfaced a real strategic problem it cannot solve alone.

Resolution: Standing question in weekly summary: "This week drove X impressions and Y trials. Conversion rate is Z%. Here is the gap."

Year-end: Founder finds middle path. Educational series ending with product demo. Conversion improves.

> **REFINEMENT B3:** Weekly summary must always show content performance alongside the business metric that matters.

---

## Simulation Set C: Solo Creator/Educator

### C1. Daily

**Day 1 -- Hit: Insight Captured in the Moment**

Input (voice note, walking): "Most people learn frameworks by reading docs first. Completely backwards. You should break something first, then read why it broke. Docs are repair manuals, not tutorials."

Acting: Twitter thread (contrarian hook). Newsletter paragraph. YouTube short script. Voice note used verbatim for hook.

Outcome: Twitter 2,400 retweets. Newsletter 34 replies - highest ever. YouTube short 180K views in 48 hours.

Engine: Logs "contrarian-framing outperforms how-to by 4x. Prioritise this format."

**Day 6 -- Miss: 5-Day Silence, Burnout**

Engine Day 3: Gentle nudge. "Here are 3 ideas from last week's comments. Thumbs up if any feel right."

Engine Day 5: No response. Preservation mode: reposts evergreen content with light update.

Gap found: Repost-without-approval cannot be a surprise. Requires explicit opt-in.

> **REFINEMENT C1:** Burnout Protocol in onboarding. Creator pre-approves evergreen bank. Engine draws from bank only if silence exceeds user-set threshold.

### C2. Monthly

**Month 5 -- Shock: Sponsor Pulls Out**

Event: Main newsletter sponsor cancels. 40% of monthly revenue gone.

Brain Dump: "I need to grow subscribers fast. Post everything."

Noticing: Detects high-stress input. Flags to Strategist before acting.

Strategist: Does not execute panic. "Posting more will not solve a sponsorship problem. Here are 3 things that grew your subscribers fastest: collaborative posts, contrarian threads, long-form YouTube."

Outcome: Panic avoided. New sponsor found 2 months later. Subscribers up 18% from collab.

> **REFINEMENT C2:** Noticing must detect emotional state and flag to Strategist first. Strategist must have authority to push back when data contradicts stated intent.

### C3. Year-Long: Audience Mismatch

Month 1-3: Growing audience. Shallow engagement. Something is off.

Month 4: Quarterly review: career advice posts get 6x engagement of technical posts. Wrong audience followed.

Month 5: Identity question: serve the audience that showed up or double down on intended depth?

Engine: Cannot make the decision. Can present the paths clearly.

Strategist presents:
- Path A - lean into career content: 40% subscriber growth, recruiter sponsor appeal.
- Path B - stay technical: slower growth, higher revenue per subscriber from tool sponsorships.

Month 6-9: Creator chooses Path B. Engine filters out career-adjacent opportunities. Doubles down on technical signal.

Month 10-12: Right audience finds the content. Stickier growth. Revenue per subscriber increases.

Year-end: Engine's greatest contribution was the quarterly review that forced a decision the creator had been avoiding for months.

> **REFINEMENT C3:** When strategic fork detected, Strategist presents two projected paths with estimated outcomes - not just the diagnosis.

---

## Consolidated Refinements Table (Original 10)

| Ref | Refinement | What Changes | Priority |
|---|---|---|---|
| A1 | Content source tag | Every approval card shows origin: Brain Dump / Fallback / Amplification | Must Have |
| A2 | Skip reason capture | One-tap reason. Feeds voice profile and channel selection. | Must Have |
| A3 | Competitor monitoring | Reviewing Agent scrapes competitor activity weekly. | Nice to Have |
| A4 | Quarterly narrative review | Drift score + course-correction vs original goal statement. | Must Have |
| B1 | Outside engine audit | Weekly summary flags manual posts, assesses brand impact. | Should Have |
| B2 | Launch Mode | High-cadence real-time mode. Manually activated, 24h limit. | Should Have |
| B3 | Business outcome correlation | Weekly summary shows content vs business metric always. | Must Have |
| C1 | Burnout Protocol | Pre-approved evergreen bank. Explicit opt-in. Silence trigger. | Must Have |
| C2 | Emotional state detection | Noticing flags panic to Strategist. Strategist can push back. | Must Have |
| C3 | Path simulation | Strategic fork -> two projected paths with outcomes. | Should Have |

---

## Simulation Conclusion

The engine's highest-value moments are not the daily drafts.

They are the quarterly reviews, the pushback on emotional decisions, and the drift corrections.

The operational layer keeps the engine running. The Strategist layer is what makes it worth having.
