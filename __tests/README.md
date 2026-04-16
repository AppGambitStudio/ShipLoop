# ShipLoop — AI Viability Tests

4 validation tests that mirror the actual AI patterns in production. Each test uses the same pattern (zero-shot, few-shot, review-and-regenerate, multi-step agent) that the real system will use.

## What Each Test Validates

| Test | Pattern Tested | Needs Your Data? | Key Question |
|---|---|---|---|
| 1. Voice Profile | Few-shot + review-and-regenerate | YES (real posts + brain dumps) | Can the draft→score→re-draft loop produce approvable content? |
| 2. Strategist | Multi-step agent with tools | No (simulated data) | Can Opus reason across data sources and produce specific directives? |
| 3. Noticing | Zero-shot single call | YES (real brain dumps + ground truth) | Can Sonnet extract the right opportunities from messy input? |
| 4. Confidence | Few-shot score + review-and-regenerate | No (simulated data) | Do AI scores correlate with human approval? Does re-draft improve output? |

## Setup

```bash
cd .tests
npm install
cp .env.example .env
# Edit .env with your API keys
```

## Before Running

**Tests 2 and 4** can run immediately — they use simulated/self-generated data.

**Tests 1 and 3** need your real data:
- `data/real-posts.json` — 20 of your real LinkedIn/Twitter posts + 5 brain dumps
- `data/real-brain-dumps.json` — 10 real brain dumps + your manual ground-truth extraction

## Running

```bash
# Start with these (no personal data needed):
npm run test:strategist    # Test 2 — most complex, validates the core agent
npm run test:confidence    # Test 4 — validates scoring + re-draft loop

# Then fill in your data and run:
npm run test:voice         # Test 1 — validates voice profile learning
npm run test:noticing      # Test 3 — validates extraction accuracy
```

## Pass/Fail Criteria

| Test | Primary Pass | Secondary Pass | If Fails |
|---|---|---|---|
| 1. Voice | 3/5 final drafts A or E | Re-draft improves 50%+ of cases | Voice learning needs different approach |
| 2. Strategist | 3+ specific, data-referencing directives | Agent calls tools in logical order | May need rules-based approach in v1 |
| 3. Noticing | 80%+ precision, 70%+ recall | Emotional state >70% accuracy | Prompt iteration needed (fixable) |
| 4. Confidence | Top-third >70% approval, bottom <40% | Re-draft improves 50%+ | Drop confidence routing in v1 |

## How Tests Map to Production Patterns

```
Test 1 (Voice)      → Acting Agent: few-shot prompt assembly + review-and-regenerate loop
Test 2 (Strategist) → Strategist Agent: multi-step agent with custom tools (simulates Managed Agents)
Test 3 (Noticing)   → Noticing Agent: zero-shot single call with assembled context
Test 4 (Confidence) → Acting Agent: confidence scoring + re-draft loop across quality tiers
```

See `.docs/07 - AI Patterns/` for the full touchpoint mapping.

## Estimated Cost
~₹1,500-2,500 total in API calls ($15-25). Test 2 (Opus) is the most expensive single test.
