# SHIPLOOP — Cost Comparison: ShipLoop vs Full-Time Person

Spec Section 06

---

## 1. ShipLoop Monthly Cost (Estimated)

### AI / LLM Costs

| Agent | Model | Calls/month | Input tokens | Output tokens | Cost/month |
|---|---|---|---|---|---|
| Strategist | Opus ($15/$75 per M) | 4 weekly + 1 quarterly avg | ~600K input | ~40K output | ~₹1,100 ($12) |
| Noticing | Sonnet ($3/$15 per M) | ~20 (per brain dump) | ~100K | ~40K | ~₹92 ($1) |
| Acting (draft + score) | Sonnet ($3/$15 per M) | ~80 (2 calls x 40 opportunities) | ~800K | ~240K | ~₹550 ($6) |
| Reviewing | Sonnet ($3/$15 per M) | 4 weekly | ~120K | ~20K | ~₹92 ($1) |
| Edit diffs, fast-checks | Sonnet | ~15 | ~50K | ~20K | ~₹185 ($2) |
| Managed Agents session fee | — | 4 sessions x ~15 min | — | — | ~₹92 ($1) |
| Whisper (voice notes) | Whisper API | ~20 notes | — | — | ~₹185 ($2) |
| **Total AI** | | | | | **~₹2,300 ($25)** |

### Infrastructure Costs

| Service | Cost/month |
|---|---|
| Neon Postgres (free tier → starter) | ₹0 - ₹1,750 ($0-19) |
| AWS Lambda (ARM64, low volume) | ~₹460 ($5) |
| SQS (5 queues, low volume) | ~₹92 ($1) |
| Step Functions | ~₹92 ($1) |
| API Gateway | ~₹185 ($2) |
| DynamoDB (on-demand) | ~₹92 ($1) |
| S3 (voice files, context JSONs) | ~₹92 ($1) |
| **Total Infra** | **~₹1,100 - ₹2,750 ($12-30)** |

### ShipLoop Total: ₹3,400 - ₹5,050/month (~$37-55)

---

## 2. Full-Time Person Cost (India)

The fair comparison isn't a junior social media manager. ShipLoop replaces someone who can:
- Understand technical brain dumps and translate to distribution
- Draft in the founder's voice across 5+ platforms
- Think strategically about narrative/funnel/cadence
- Collect and analyse engagement signals weekly
- Push back on emotional decisions with data
- Know the difference between a LinkedIn post and an HN post

| Role | Monthly Salary (INR) | What you get |
|---|---|---|
| Junior content writer | ₹15,000 - ₹25,000 | Can write, but doesn't understand tech. Needs heavy guidance. Won't push back. |
| Freelance distribution person (part-time) | ₹20,000 - ₹35,000 | 10-15 hours/week. No strategic thinking. Executes what you tell them. |
| Mid-level content strategist | ₹40,000 - ₹60,000 | Can think about angles and channels. Still needs you to explain the tech. |
| Senior content strategist (tech-savvy) | ₹60,000 - ₹1,00,000 | Understands tech, can draft without hand-holding, thinks strategically. This is the real comparison. |
| Content + distribution lead | ₹80,000 - ₹1,50,000 | Full ownership. Strategy, execution, analytics. Rare at this price. |

### Realistic comparison target: ₹60,000 - ₹1,00,000/month

---

## 3. Side-by-Side Comparison

| Dimension | ShipLoop | Full-Time Person (₹60K-1L) |
|---|---|---|
| **Monthly cost** | ₹3,400 - ₹5,050 | ₹60,000 - ₹1,00,000 |
| **Annual cost** | ₹41,000 - ₹60,600 | ₹7,20,000 - ₹12,00,000 |
| **Cost ratio** | — | **15-25x more expensive** |
| **Availability** | 24/7, processes in seconds | 8-10 hours/day, weekdays |
| **Brain dump → draft** | < 1 minute | Hours to next day |
| **Voice learning** | Systematic, per-platform, compounds from every approval/edit/skip | Subjective, depends on person's intuition |
| **Strategic pushback** | Data-driven, drift score, path simulations | Depends on confidence and relationship |
| **Consistency** | Never forgets, never has a bad day | Human variability |
| **Silence handling** | Burnout protocol auto-activates | Goes silent when you go silent |
| **Multi-platform knowledge** | LinkedIn, Twitter, HN, Reddit, IndieHackers, YouTube, Newsletter, Dev.to — all with platform-specific formatting | Typically strong on 1-2 platforms |
| **Scales with brain dumps** | Handles 1/day or 5/day identically | More input = more hours needed |
| **Onboarding** | 10 minutes | 2-4 weeks |
| **Turnover risk** | None | High for this role at this salary |

---

## 4. What ShipLoop Does NOT Replace

- **Creative direction** — the human still decides what to build and what matters
- **Relationship building** — DMs, replies, community engagement still need the human
- **Crisis communication** — sensitive situations need human judgment
- **Original long-form content** — blog posts, videos, talks are seeded by the engine but created by the human

---

## 5. The Real Math

For an indie builder or small team in India:

```
ShipLoop: ₹4,500/month
vs
Hiring someone: ₹60,000/month minimum for comparable quality

Savings: ₹55,500/month = ₹6,66,000/year (~$7,200/year)
```

That's essentially a senior content strategist that works 24/7, learns your voice, never quits, and costs less than a team lunch.

---

## 6. Cost Scaling

These estimates assume a single user with ~20 brain dumps/month. How costs change with usage:

| Usage level | Brain dumps/month | Opportunities | AI cost | Infra cost | Total |
|---|---|---|---|---|---|
| Light | 10 | 20 | ~₹1,300 | ~₹1,100 | ~₹2,400 |
| Normal | 20 | 40 | ~₹2,300 | ~₹1,650 | ~₹3,950 |
| Heavy | 40 | 80 | ~₹4,150 | ~₹2,200 | ~₹6,350 |
| Power user | 60+ | 120+ | ~₹6,000 | ~₹2,750 | ~₹8,750 |

Even a power user at ₹8,750/month is 7-11x cheaper than a human equivalent.

### Cost Assumptions
- USD to INR: ~₹92 (as of April 2026)
- Claude Opus: $15/M input, $75/M output tokens
- Claude Sonnet: $3/M input, $15/M output tokens
- Managed Agents: $0.08/session-hour
- Whisper API: $0.006/minute
- AWS pricing: ap-south-1 (Mumbai) region
- Neon: free tier for development, starter plan ($19/month) for production
