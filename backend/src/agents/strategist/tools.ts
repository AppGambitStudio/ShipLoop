/**
 * Custom tool definitions for the Strategist Managed Agent.
 * Passed to client.beta.agents.create() at agent creation time.
 *
 * The Strategist calls these tools during a session.
 * Our code handles execution (Postgres queries) and returns results.
 *
 * IMPORTANT: Descriptions must be extremely detailed — they are the
 * primary way the agent knows when and how to use each tool.
 */

export const strategistCustomTools = [
  {
    type: "custom" as const,
    name: "read_asset_registry",
    description: `Returns all registered assets for this user. Each asset includes: name, category (open_source/product/content/talk), one-line description, distribution status (undistributed/in_progress/distributed/amplified), priority score (0-1, set by you on previous runs), last distribution date, and target audience.

Call this FIRST in every run to understand the builder's portfolio. Use it to identify undistributed assets, stale assets, and gaps in the distribution narrative.`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    type: "custom" as const,
    name: "read_posted_content",
    description: `Returns content that was drafted, approved, and posted to platforms over the last N days. Each entry includes: platform, content text, confidence score, approval status (approved/edited), engagement metrics (upvotes, comments, traction flag), and the opportunity description it was derived from.

Use days=30 for weekly runs. Use days=90 for quarterly runs. Cross-reference with approval patterns to understand what content types are working vs what the builder is rejecting.`,
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number" as const,
          description: "Number of days to look back. Use 30 for weekly runs, 90 for quarterly.",
        },
      },
      required: ["days"],
    },
  },
  {
    type: "custom" as const,
    name: "read_internal_monologue",
    description: `Returns your own previous internal monologue entries for continuity of thought. Each entry includes the week date, the full monologue text, directives issued, narrative assessment, and drift score.

Always read the last 2 entries at the start of a weekly run (for continuity). Read last 4 for quarterly runs. Your monologue is your memory — use it to track what you were thinking, what you planned, and whether it played out.`,
    input_schema: {
      type: "object" as const,
      properties: {
        count: {
          type: "number" as const,
          description: "Number of recent monologue entries to return. Use 2 for weekly, 4 for quarterly.",
        },
      },
      required: ["count"],
    },
  },
  {
    type: "custom" as const,
    name: "read_user_config",
    description: `Returns the user's configuration set during onboarding: company type (service_company/saas_founder/solo_creator/indie_builder), 90-day goal statement, active distribution channels, silence threshold, and signal definitions.

The goal statement is your north star — every directive should serve it. The company type determines your thinking style: narrative arcs (service), funnels (SaaS), cadence (creator), or momentum (indie builder).`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    type: "custom" as const,
    name: "read_approval_patterns",
    description: `Returns how the builder interacted with drafted content over the last N days: how many drafts were approved as-is, how many were edited (with diff category summaries showing what changed), how many were skipped (with skip reason distribution: tone_wrong, angle_wrong, timing_wrong, too_generic, other).

This is critical data. High skip rates on certain angles mean stop generating them. Edit patterns show what the builder changes — if they always shorten your drafts, you're writing too long. If they always remove marketing language, stop using it.`,
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number" as const,
          description: "Number of days to look back.",
        },
      },
      required: ["days"],
    },
  },
  {
    type: "custom" as const,
    name: "write_directives",
    description: `Saves your strategic directives. This is your PRIMARY output — it governs how the Noticing and Acting agents behave until the next Strategist run.

Call this ONCE at the end of your reasoning, never mid-session. Include:
- channelWeights: which platforms to prioritize (0-1 per channel)
- contentAngleDefaults: ordered list of preferred content angles
- priorityAssetIds: which assets should be distributed next (ordered)
- silenceAlarm: whether the builder's silence threshold has been breached
- urgencyOverrides: any asset-specific urgency changes
- narrativeAssessment: one paragraph on narrative coherence
- driftScore: 0-1 measuring drift from the original goal statement
- pathSimulation: (quarterly only) two projected paths if a strategic fork is detected`,
    input_schema: {
      type: "object" as const,
      properties: {
        directives: {
          type: "object" as const,
          properties: {
            channelWeights: { type: "object" as const },
            contentAngleDefaults: { type: "array" as const, items: { type: "string" as const } },
            priorityAssetIds: { type: "array" as const, items: { type: "string" as const } },
            silenceAlarm: { type: "boolean" as const },
            urgencyOverrides: { type: "object" as const },
          },
          required: ["channelWeights", "contentAngleDefaults", "priorityAssetIds", "silenceAlarm"],
        },
        narrativeAssessment: { type: "string" as const },
        driftScore: { type: "number" as const },
        pathSimulation: {
          type: "object" as const,
          properties: {
            pathA: { type: "string" as const },
            pathB: { type: "string" as const },
          },
        },
      },
      required: ["directives", "narrativeAssessment", "driftScore"],
    },
  },
  {
    type: "custom" as const,
    name: "write_monologue",
    description: `Saves your updated internal monologue entry for this run. Write in first person, direct personal voice. This is your thinking-out-loud document.

Include: what you observed in the data, what surprised you, what you think should change, what worked and what didn't from your previous directives. Future runs will read this for continuity — be specific, reference actual assets and metrics, not generalities.

Call this AFTER write_directives.`,
    input_schema: {
      type: "object" as const,
      properties: {
        monologue: {
          type: "string" as const,
          description: "Your internal monologue in markdown. Be specific and reference actual data.",
        },
      },
      required: ["monologue"],
    },
  },
];
