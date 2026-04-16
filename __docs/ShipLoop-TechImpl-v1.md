**SHIPLOOP**

*Implementation-Level Technical Specification*

AWS Serverless + SST v4 + Claude Managed Agents

**Stack Decisions**

|  |  |
|----|----|
| **Database** | Postgres primary (Neon or Aurora Serverless v2) — DynamoDB for session/queue state only |

|  |  |
|----|----|
| **AI Layer** | Claude Managed Agents (Opus) for Strategist. Sonnet via OpenRouter for Noticing, Acting, and Reviewing (quality-first) |

|  |  |
|----|----|
| **Long-Running Tasks** | Step Functions to orchestrate multi-step Strategist and Reviewing agent runs |

|  |  |
|----|----|
| **Infrastructure** | SST v4 Ion on AWS — API Gateway v2, Lambda ARM64, EventBridge, SQS, S3 |

|  |  |
|----|----|
| **Frontend** | Next.js 14 App Router on Lambda via SST — no separate hosting |

|  |  |
|----|----|
| **Queuing** | SQS over BullMQ — serverless-native, no always-on Redis required |

**1. Architecture Overview**

This spec covers every technical decision, implementation trap, and AWS-specific concern for ShipLoop. It assumes SST v4 Ion, TypeScript throughout, and familiarity with AWS serverless patterns.

**1.1 Service Map**

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>Browser / Mobile</p>
<p>│</p>
<p>▼</p>
<p>API Gateway v2 (HTTP API)</p>
<p>│</p>
<p>├── /api/* ──────────── Lambda (Next.js App Router via SST open-next)</p>
<p>│</p>
<p>└── /webhooks/* ─────── Lambda (future platform connector callbacks)</p>
<p>│</p>
<p>▼</p>
<p>SQS Queues (one per agent pipeline stage)</p>
<p>│</p>
<p>├── noticing-queue ──── Lambda (Noticing Agent — OpenRouter Sonnet)</p>
<p>├── acting-queue ────── Lambda (Acting Agent — OpenRouter Sonnet, draft + score)</p>
<p>├── posting-queue ───── Lambda (v1: tracks manual posts. Future: auto-publish connectors)</p>
<p>└── reviewing-queue ─── EventBridge cron → Step Functions</p>
<p>│</p>
<p>▼</p>
<p>Step Functions (Strategist + Reviewing long-running orchestration)</p>
<p>│</p>
<p>├── State 1: Hydrate context from Postgres</p>
<p>├── State 2: Invoke Claude Managed Agent session (SSE stream)</p>
<p>├── State 3: Parse + validate output</p>
<p>└── State 4: Write directives + monologue back to Postgres</p>
<p>│</p>
<p>▼</p>
<p>Postgres (Neon or Aurora Serverless v2 — via connection pooler)</p>
<p>+ DynamoDB (sessions, SQS deduplication, idempotency tokens)</p>
<p>+ S3 (brain dump voice files, Strategist monologue archive)</p></td>
</tr>
</tbody>
</table>

**2. Database Layer**

**2.1 Postgres vs Aurora vs Neon — The Real Decision**

Both are valid. The choice matters for cost, cold start, and operational overhead. Here is the honest tradeoff:

|  |  |  |
|----|----|----|
| **Factor** | **Neon Serverless** | **Aurora Serverless v2** |
| **Minimum cost** | ~$0/mo (scales to zero) | ~$43/mo (0.5 ACU minimum always-on) |
| **Cold start** | ~500ms on first query after sleep | Stays warm, no cold start |
| **Max connections** | Pooled via built-in pooler | Needs RDS Proxy (~$30/mo) for Lambda |
| **Branching** | Yes — instant DB branches for staging | No native branching |
| **VPC requirement** | No — public endpoint with SSL | Yes — must be in VPC, complicates Lambda |
| **Switch-out effort** | Low — standard Postgres wire protocol | Low — same wire protocol |
| **Best for ShipLoop** | Phase 1 build and solo use | If you add team members or need SLA |

|  |  |
|:--:|----|
| **DECISION** | Start with Neon. The spec is written for Neon. Aurora swap requires only changing the connection string and removing VPC config — the schema and ORM layer are identical. |

**2.2 Connection Strategy — The Lambda Problem**

Lambda + Postgres has a well-known problem: each Lambda invocation opens a new connection. At scale, connection exhaustion kills the database. Two solutions exist and both must be applied.

**Solution A: Neon HTTP Driver for short-lived Lambdas**

The Neon serverless driver sends queries over HTTP/WebSocket instead of a persistent TCP connection. No connection pooling needed. Use this for all Noticing and Acting agent Lambdas — they run fast and close immediately.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// sst/packages/core/db.ts</p>
<p>import { neon } from '@neondatabase/serverless';</p>
<p>import { drizzle } from 'drizzle-orm/neon-http';</p>
<p>import * as schema from './schema';</p>
<p>const sql = neon(process.env.DATABASE_URL!);</p>
<p>export const db = drizzle(sql, { schema });</p>
<p>// Use this in: Noticing Lambda, Acting Lambda, Posting Lambda</p>
<p>// DO NOT use for Step Functions states — use Solution B there</p></td>
</tr>
</tbody>
</table>

**Solution B: PgBouncer / Neon pooler for Step Functions**

Step Functions runs multiple Lambda invocations in sequence for the Strategist. Each state function needs a real connection. Use Neon's built-in connection pooler endpoint (port 6432). This pools across Lambda warm containers automatically.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// For Step Functions states — use the POOLED endpoint</p>
<p>// Neon provides two connection strings:</p>
<p>// Direct: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/shiploop</p>
<p>// Pooled: postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/shiploop</p>
<p>// sst.config.ts — set both as secrets</p>
<p>const DATABASE_URL = new sst.Secret('DatabaseUrl'); // direct</p>
<p>const DATABASE_POOL_URL = new sst.Secret('DatabasePoolUrl'); // pooled</p>
<p>// Step Functions Lambdas use DATABASE_POOL_URL</p>
<p>// All other Lambdas use the Neon HTTP driver (no URL needed)</p></td>
</tr>
</tbody>
</table>

|  |  |
|:--:|----|
| **TRAP** | Never use the Neon HTTP driver inside Step Functions states. The HTTP driver creates a new HTTP connection per query. Inside a Step Functions state that runs multiple queries, this adds 100-300ms per query and can hit Neon's concurrent connection limits. |

**2.3 Drizzle Schema — Full Implementation**

Complete schema with every field including simulation-derived additions. All enums defined as Postgres native enums for type safety and query efficiency.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// packages/core/src/schema.ts</p>
<p>import { pgTable, pgEnum, uuid, text, timestamp,</p>
<p>boolean, real, jsonb, date, integer } from 'drizzle-orm/pg-core';</p>
<p>// ── Enums ───────────────────────────────────────────────────</p>
<p>export const assetCategory = pgEnum('asset_category',</p>
<p>['open_source', 'product', 'content', 'talk']);</p>
<p>export const distributionStatus = pgEnum('distribution_status',</p>
<p>['undistributed', 'in_progress', 'distributed', 'amplified']);</p>
<p>export const inputSource = pgEnum('input_source', ['text', 'voice']);</p>
<p>export const emotionalState = pgEnum('emotional_state',</p>
<p>['neutral', 'stressed', 'excited']); // from sim C2</p>
<p>export const urgency = pgEnum('urgency', ['high', 'medium', 'low']);</p>
<p>export const platform = pgEnum('platform',</p>
<p>['reddit', 'linkedin', 'twitter', 'youtube', 'newsletter', 'github_readme', 'hackernews', 'indiehackers', 'devto', 'other']);</p>
<p>export const contentSource = pgEnum('content_source',</p>
<p>['brain_dump', 'strategist_fallback', 'signal_amplification']); // from sim A1</p>
<p>export const approvalStatus = pgEnum('approval_status',</p>
<p>['pending', 'approved', 'edited', 'skipped']);</p>
<p>export const skipReason = pgEnum('skip_reason',</p>
<p>['tone_wrong', 'angle_wrong', 'timing_wrong', 'too_generic', 'other']); // from sim A2</p>
<p>export const tractionFlag = pgEnum('traction_flag', ['none', 'some', 'strong']);</p>
<p>export const competitorSignalType = pgEnum('competitor_signal_type',</p>
<p>['new_product', 'viral_post', 'pricing_change', 'other']); // from sim A3</p>
<p>// ── Tables ──────────────────────────────────────────────────</p>
<p>export const assets = pgTable('assets', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>name: text('name').notNull(),</p>
<p>oneLiner: text('one_liner').notNull(),</p>
<p>category: assetCategory('category').notNull(),</p>
<p>githubUrl: text('github_url'),</p>
<p>liveUrl: text('live_url'),</p>
<p>targetAudience: text('target_audience').notNull(),</p>
<p>distributionStatus: distributionStatus('distribution_status')</p>
<p>.notNull().default('undistributed'),</p>
<p>lastDistributedAt: timestamp('last_distributed_at'),</p>
<p>priorityScore: real('priority_score').notNull().default(0.5),</p>
<p>// Strategist sets this each week (0-1)</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const inputDumps = pgTable('input_dumps', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>rawText: text('raw_text').notNull(),</p>
<p>source: inputSource('source').notNull().default('text'),</p>
<p>voiceTranscript: text('voice_transcript'),</p>
<p>voiceS3Key: text('voice_s3_key'), // S3 key for original audio</p>
<p>emotionalState: emotionalState('emotional_state').default('neutral'),</p>
<p>processedAt: timestamp('processed_at'),</p>
<p>sqsMessageId: text('sqs_message_id'), // for idempotency</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const opportunities = pgTable('opportunities', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>inputDumpId: uuid('input_dump_id').notNull()</p>
<p>.references(() =&gt; inputDumps.id),</p>
<p>assetId: uuid('asset_id').references(() =&gt; assets.id), // nullable</p>
<p>description: text('description').notNull(),</p>
<p>angle: text('angle').notNull(),</p>
<p>urgency: urgency('urgency').notNull().default('medium'),</p>
<p>relevanceScore: real('relevance_score').notNull(),</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const draftedContent = pgTable('drafted_content', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>opportunityId: uuid('opportunity_id').notNull()</p>
<p>.references(() =&gt; opportunities.id),</p>
<p>platform: platform('platform').notNull(),</p>
<p>target: text('target').notNull(), // subreddit, linkedin tag, etc</p>
<p>content: text('content').notNull(),</p>
<p>confidenceScore: real('confidence_score').notNull(),</p>
<p>sourceTag: contentSource('source_tag').notNull(),</p>
<p>approvalStatus: approvalStatus('approval_status')</p>
<p>.notNull().default('pending'),</p>
<p>skipReason: skipReason('skip_reason'), // null if not skipped</p>
<p>approvedContent: text('approved_content'), // null until approved/edited</p>
<p>approvedAt: timestamp('approved_at'),</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const postedContent = pgTable('posted_content', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>draftedContentId: uuid('drafted_content_id').notNull()</p>
<p>.references(() =&gt; draftedContent.id),</p>
<p>platformPostId: text('platform_post_id'), // external ID</p>
<p>postedAt: timestamp('posted_at').notNull(),</p>
<p>postUrl: text('post_url'),</p>
<p>engagementLastChecked: timestamp('engagement_last_checked'),</p>
<p>upvotes: integer('upvotes').default(0),</p>
<p>comments: integer('comments').default(0),</p>
<p>tractionFlag: tractionFlag('traction_flag').default('none'),</p>
<p>isOutsideEngine: boolean('is_outside_engine').default(false),</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const strategistMemory = pgTable('strategist_memory', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>weekOf: date('week_of').notNull(),</p>
<p>internalMonologue: text('internal_monologue').notNull(), // markdown</p>
<p>directives: jsonb('directives').notNull(),</p>
<p>// { channelWeights, contentAngles, priorityAssetIds, silenceThreshold }</p>
<p>priorityAssets: jsonb('priority_assets').notNull(), // ordered list</p>
<p>narrativeAssessment: text('narrative_assessment').notNull(),</p>
<p>driftScore: real('drift_score').default(0), // 0-1</p>
<p>pathSimulation: jsonb('path_simulation'), // null unless fork detected</p>
<p>goalsSnapshot: text('goals_snapshot').notNull(),</p>
<p>managedAgentSession: text('managed_agent_session_id'), // Anthropic session ID</p>
<p>createdAt: timestamp('created_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const competitorSignals = pgTable('competitor_signals', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>competitorName: text('competitor_name').notNull(),</p>
<p>platform: text('platform').notNull(),</p>
<p>signalType: competitorSignalType('signal_type').notNull(),</p>
<p>summary: text('summary').notNull(),</p>
<p>sourceUrl: text('source_url'),</p>
<p>detectedAt: timestamp('detected_at').notNull().defaultNow(),</p>
<p>});</p>
<p>export const evergreenBank = pgTable('evergreen_bank', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>assetId: uuid('asset_id').references(() =&gt; assets.id),</p>
<p>content: text('content').notNull(),</p>
<p>platform: platform('platform').notNull(),</p>
<p>approvedAt: timestamp('approved_at').notNull(),</p>
<p>timesUsed: integer('times_used').default(0),</p>
<p>lastUsedAt: timestamp('last_used_at'),</p>
<p>});</p>
<p>export const userConfig = pgTable('user_config', {</p>
<p>id: uuid('id').primaryKey().defaultRandom(),</p>
<p>companyType: text('company_type').notNull(),</p>
<p>goalStatement: text('goal_statement').notNull(),</p>
<p>channels: jsonb('channels').notNull(), // channel registry</p>
<p>signalDefinitions: jsonb('signal_definitions').notNull(),</p>
<p>competitors: jsonb('competitors').default('[]'),</p>
<p>silenceThresholdDays: integer('silence_threshold_days').default(7),</p>
<p>burnoutProtocolDays: integer('burnout_protocol_days'), // null = disabled</p>
<p>updatedAt: timestamp('updated_at').notNull().defaultNow(),</p>
<p>});</p></td>
</tr>
</tbody>
</table>

**2.4 DynamoDB Schema — Session and Queue State**

DynamoDB handles only ephemeral, high-write state that does not need relational queries. Three use cases: SQS idempotency, Managed Agent session tracking, and approval UI session state.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// Single-table design — PK/SK pattern</p>
<p>// Table: shiploop-state</p>
<p>// Pattern 1: SQS idempotency</p>
<p>// PK: IDEM#&lt;sqs_message_id&gt; SK: IDEM</p>
<p>// TTL: 24 hours (prevents duplicate processing on SQS redelivery)</p>
<p>// Pattern 2: Managed Agent session tracking</p>
<p>// PK: SESSION#&lt;managed_agent_session_id&gt; SK: METADATA</p>
<p>// Attrs: status, started_at, step_function_execution_arn, output_s3_key</p>
<p>// Pattern 3: Approval UI active session</p>
<p>// PK: APPROVAL#&lt;user_id&gt; SK: ACTIVE</p>
<p>// Attrs: draft_ids_in_session, last_action_at</p>
<p>// TTL: 2 hours (cleans up abandoned sessions)</p>
<p>// sst.config.ts</p>
<p>const stateTable = new sst.aws.Dynamo('StateTable', {</p>
<p>fields: { pk: 'string', sk: 'string' },</p>
<p>primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },</p>
<p>ttl: 'ttl',</p>
<p>transform: {</p>
<p>table: { billingMode: 'PAY_PER_REQUEST' }</p>
<p>}</p>
<p>});</p></td>
</tr>
</tbody>
</table>

**3. AI Layer — Agent Architecture**

**3.1 Claude Managed Agents — What It Actually Is**

Claude Managed Agents (public beta, April 2026) is Anthropic's hosted agent harness. Instead of you building the agent loop, tool execution, sandboxing, and state management, Anthropic runs it. You define the agent once via API, create sessions, send events, and stream results via SSE.

|  |  |
|----|----|
| **API surface** | POST /v1/agents — define agent. POST /v1/environments — create sandbox. POST /v1/sessions — start session. POST /v1/sessions/{id}/events — send message. GET /v1/sessions/{id}/events — stream SSE output. |
| **Beta header required** | managed-agents-2026-04-01 on every request |
| **Pricing** | $0.08 per session-hour + standard Claude token rates |
| **Session duration** | Long-running — hours if needed. Progress persists through disconnections. |
| **Multi-agent** | Research preview only — requires separate access request. NOT available in standard beta. |
| **Memory feature** | Research preview — same restriction. NOT available in standard beta. |
| **Built-in tools** | agent_toolset_20260401 — includes bash, read, write, web_search, web_fetch, code_execution. Disable what you don't need. |
| **Custom tools** | Defined at agent creation time with full JSON schema. Agent invokes them during session. |

|  |  |
|:--:|----|
| **CRITICAL** | Multi-agent coordination and the Memory tool are in research preview — they require a separate access request and are NOT part of the standard public beta. Do not architect ShipLoop to depend on either of these in Phase 1. The Strategist will use custom tools to read/write Postgres directly instead of the managed Memory feature. |

**3.2 Agent Definitions — SST Resources**

Agents are created once and versioned. Store agent IDs in SST secrets. Each agent definition lives in its own YAML file managed by the ant CLI for versioning.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p># agents/strategist.yaml — managed via ant CLI</p>
<p>name: ShipLoop Strategist</p>
<p>model: claude-opus-4-6</p>
<p>system: |</p>
<p>You are the Strategist for ShipLoop — a distribution engine for builders.</p>
<p>Your role is NOT to draft content. Your role is to think, assess, and direct.</p>
<p>You have access to the following tools:</p>
<p>- read_asset_registry: returns all assets with priority scores and distribution history</p>
<p>- read_posted_content: returns all posts from the last N days with engagement signals</p>
<p>- read_internal_monologue: returns your previous internal monologue entries</p>
<p>- read_user_config: returns the user's goal statement, channel registry, and preferences</p>
<p>- write_directives: saves your strategic directives for the Acting and Noticing agents</p>
<p>- write_monologue: saves your updated internal monologue entry for this week</p>
<p>- write_priority_assets: saves the ordered priority asset list</p>
<p>Always start by reading the last 2 internal monologue entries and the last 30 days</p>
<p>of posted content and engagement signals. Reason over time, not just this moment.</p>
<p>Your output must always include:</p>
<p>1. Updated internal monologue (markdown, personal voice, direct)</p>
<p>2. Directives JSON (channel weights, content angle defaults, urgency overrides)</p>
<p>3. Priority assets (ordered list with reasoning per asset)</p>
<p>4. Narrative assessment (one paragraph: is the story coherent?)</p>
<p>5. Drift score (float 0-1: how far has content drifted from the original goal?)</p>
<p>tools:</p>
<p>- type: agent_toolset_20260401</p>
<p>default_config:</p>
<p>enabled: false # disable all built-in tools</p>
<p>configs:</p>
<p>- name: bash</p>
<p>enabled: false</p>
<p>- name: web_search</p>
<p>enabled: false</p>
<p>- type: custom</p>
<p>name: read_asset_registry</p>
<p>description: |</p>
<p>Returns all registered assets with their distribution status, priority score,</p>
<p>last distribution date, and category. Use this first in every Strategist run.</p>
<p>input_schema:</p>
<p>type: object</p>
<p>properties: {}</p>
<p>- type: custom</p>
<p>name: read_posted_content</p>
<p>description: |</p>
<p>Returns posted content from the last N days with full engagement metrics.</p>
<p>Always call with days=30 on quarterly runs. days=7 on weekly runs.</p>
<p>input_schema:</p>
<p>type: object</p>
<p>properties:</p>
<p>days: { type: integer, description: 'Number of days to look back' }</p>
<p>required: [days]</p>
<p>- type: custom</p>
<p>name: write_directives</p>
<p>description: |</p>
<p>Saves your strategic directives. This is the primary output that governs</p>
<p>how the Noticing and Acting agents behave this week. Call once at the end</p>
<p>of your reasoning, never mid-session.</p>
<p>input_schema:</p>
<p>type: object</p>
<p>properties:</p>
<p>directives:</p>
<p>type: object</p>
<p>properties:</p>
<p>channelWeights: { type: object }</p>
<p>contentAngleDefaults: { type: array }</p>
<p>priorityAssetIds: { type: array }</p>
<p>silenceAlarm: { type: boolean }</p>
<p>driftScore: { type: number }</p>
<p>narrativeAssessment: { type: string }</p>
<p>internalMonologue: { type: string }</p>
<p>required: [directives]</p></td>
</tr>
</tbody>
</table>

**3.3 Step Functions — Strategist Orchestration**

The Strategist is the most complex flow. Step Functions orchestrates it across multiple Lambda invocations, each with a defined timeout and retry policy. This avoids Lambda's 15-minute wall and gives you checkpointing.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// sst/functions/strategist-workflow.ts — Step Functions state machine</p>
<p>States:</p>
<p>1. HydrateContext</p>
<p>Type: Task</p>
<p>Lambda: strategist-hydrate</p>
<p>Timeout: 30s</p>
<p>Action: Reads Postgres — asset registry, last 30 days posts,</p>
<p>last 2 monologue entries, user config.</p>
<p>Writes hydrated context to S3 (context.json).</p>
<p>Returns: { contextS3Key, weekOf, isQuarterly }</p>
<p>2. StartManagedAgentSession</p>
<p>Type: Task</p>
<p>Lambda: strategist-start-session</p>
<p>Timeout: 60s</p>
<p>Action: Creates Managed Agent session via Anthropic API.</p>
<p>Sends user message with context S3 key reference.</p>
<p>Returns: { sessionId }</p>
<p>3. PollSessionCompletion</p>
<p>Type: Task</p>
<p>Lambda: strategist-poll-session</p>
<p>Timeout: 900s (15 min)</p>
<p>HeartbeatSeconds: 30</p>
<p>Retry: { maxAttempts: 5, backoffRate: 2 }</p>
<p>Action: Streams SSE from Managed Agent session.</p>
<p>Collects all agent.tool_use and agent.message events.</p>
<p>Waits for session.status_idle event.</p>
<p>Returns: { outputJson, toolCallsLog }</p>
<p>4. ValidateAndPersist</p>
<p>Type: Task</p>
<p>Lambda: strategist-persist</p>
<p>Timeout: 60s</p>
<p>Action: Validates Strategist output schema.</p>
<p>Writes strategist_memory row to Postgres.</p>
<p>Updates asset priority_scores in Postgres.</p>
<p>Publishes EventBridge event: strategist.run.complete</p>
<p>Catch: → ErrorNotification state on schema validation failure</p>
<p>5. ErrorNotification (Catch handler)</p>
<p>Type: Task</p>
<p>Lambda: strategist-error-notify</p>
<p>Action: Saves error to S3. Sends notification. Does not fail silently.</p></td>
</tr>
</tbody>
</table>

|  |  |
|:--:|----|
| **TRAP** | The PollSessionCompletion state streams SSE over HTTP. Lambda does not support true long-running HTTP streaming — the connection will close after the function timeout. Solution: use heartbeat polling. The Lambda polls GET /v1/sessions/{id}/events with a timeout window, checks session status, and if still running, returns a 'continue' signal to Step Functions which immediately re-invokes. This is the waitForTaskToken pattern. |

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// strategist-poll-session Lambda — heartbeat pattern</p>
<p>import { AnthropicClient } from '@anthropic-ai/sdk';</p>
<p>export const handler = async (event: {</p>
<p>sessionId: string;</p>
<p>accumulatedOutput?: string;</p>
<p>taskToken: string;</p>
<p>}) =&gt; {</p>
<p>const client = new AnthropicClient();</p>
<p>const MAX_POLL_DURATION_MS = 12 * 60 * 1000; // 12 min (under Lambda 15 min limit)</p>
<p>const startTime = Date.now();</p>
<p>let accumulatedOutput = event.accumulatedOutput || '';</p>
<p>// Stream SSE events</p>
<p>const response = await fetch(</p>
<p>`https://api.anthropic.com/v1/sessions/${event.sessionId}/events`,</p>
<p>{</p>
<p>headers: {</p>
<p>'x-api-key': process.env.ANTHROPIC_API_KEY!,</p>
<p>'anthropic-version': '2023-06-01',</p>
<p>'anthropic-beta': 'managed-agents-2026-04-01',</p>
<p>},</p>
<p>}</p>
<p>);</p>
<p>const reader = response.body!.getReader();</p>
<p>const decoder = new TextDecoder();</p>
<p>while (Date.now() - startTime &lt; MAX_POLL_DURATION_MS) {</p>
<p>const { done, value } = await reader.read();</p>
<p>if (done) break;</p>
<p>const chunk = decoder.decode(value);</p>
<p>const lines = chunk.split('\n');</p>
<p>for (const line of lines) {</p>
<p>if (!line.startsWith('data: ')) continue;</p>
<p>const event = JSON.parse(line.slice(6));</p>
<p>if (event.type === 'session.status_idle') {</p>
<p>// Session complete — return final output</p>
<p>return { status: 'complete', output: accumulatedOutput };</p>
<p>}</p>
<p>if (event.type === 'agent.tool_use') {</p>
<p>// Collect tool calls — these are the Strategist's writes</p>
<p>accumulatedOutput += JSON.stringify(event) + '\n';</p>
<p>}</p>
<p>}</p>
<p>}</p>
<p>// Heartbeat — still running, return partial state for Step Functions</p>
<p>return {</p>
<p>status: 'in_progress',</p>
<p>sessionId: event.sessionId,</p>
<p>accumulatedOutput,</p>
<p>};</p>
<p>};</p></td>
</tr>
</tbody>
</table>

**3.4 Noticing and Acting Agents — OpenRouter Pattern**

Noticing and Acting run on every brain dump — they must be fast and cheap. No managed agent sessions needed. These are standard Lambda functions calling OpenRouter via the Anthropic SDK with a custom base URL.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// packages/functions/src/noticing-agent.ts</p>
<p>import Anthropic from '@anthropic-ai/sdk';</p>
<p>import { db } from '@shiploop/core/db';</p>
<p>import { inputDumps, opportunities } from '@shiploop/core/schema';</p>
<p>import { z } from 'zod';</p>
<p>// OpenRouter uses the Anthropic SDK with a custom base URL</p>
<p>const client = new Anthropic({</p>
<p>apiKey: process.env.OPENROUTER_API_KEY,</p>
<p>baseURL: 'https://openrouter.ai/api/v1',</p>
<p>defaultHeaders: {</p>
<p>'HTTP-Referer': 'https://shiploop.io',</p>
<p>'X-Title': 'ShipLoop',</p>
<p>},</p>
<p>});</p>
<p>const OpportunitySchema = z.object({</p>
<p>opportunities: z.array(z.object({</p>
<p>description: z.string(),</p>
<p>angle: z.string(),</p>
<p>urgency: z.enum(['high', 'medium', 'low']),</p>
<p>relevanceScore: z.number().min(0).max(1),</p>
<p>suggestedChannels: z.array(z.string()),</p>
<p>existingAssetId: z.string().uuid().optional(),</p>
<p>})),</p>
<p>emotionalState: z.enum(['neutral', 'stressed', 'excited']),</p>
<p>});</p>
<p>export const handler = async (event: { dumpId: string }) =&gt; {</p>
<p>// Load dump + current Strategist directives</p>
<p>const dump = await db.query.inputDumps.findFirst({</p>
<p>where: (d, { eq }) =&gt; eq(d.id, event.dumpId),</p>
<p>});</p>
<p>if (!dump) throw new Error(`Dump ${event.dumpId} not found`);</p>
<p>const latestDirectives = await getLatestDirectives(); // from strategist_memory</p>
<p>const assetRegistry = await db.query.assets.findMany();</p>
<p>const response = await client.messages.create({</p>
<p>model: 'anthropic/claude-sonnet-4-20250514', // quality-first via OpenRouter</p>
<p>max_tokens: 2000,</p>
<p>system: buildNoticingSystemPrompt(latestDirectives, assetRegistry),</p>
<p>messages: [{ role: 'user', content: dump.rawText }],</p>
<p>});</p>
<p>const text = response.content[0].type === 'text' ? response.content[0].text : '';</p>
<p>// Parse structured JSON output</p>
<p>let parsed: z.infer&lt;typeof OpportunitySchema&gt;;</p>
<p>try {</p>
<p>const json = JSON.parse(text.replace(/```json|```/g, '').trim());</p>
<p>parsed = OpportunitySchema.parse(json);</p>
<p>} catch (e) {</p>
<p>throw new Error(`Noticing Agent output parse failure: ${e}`);</p>
<p>}</p>
<p>// Persist emotional state back to dump</p>
<p>await db.update(inputDumps)</p>
<p>.set({ emotionalState: parsed.emotionalState, processedAt: new Date() })</p>
<p>.where(eq(inputDumps.id, event.dumpId));</p>
<p>// Write opportunities</p>
<p>const inserted = await db.insert(opportunities).values(</p>
<p>parsed.opportunities.map(opp =&gt; ({</p>
<p>inputDumpId: event.dumpId,</p>
<p>assetId: opp.existingAssetId ?? null,</p>
<p>description: opp.description,</p>
<p>angle: opp.angle,</p>
<p>urgency: opp.urgency,</p>
<p>relevanceScore: opp.relevanceScore,</p>
<p>}))</p>
<p>).returning({ id: opportunities.id });</p>
<p>// Enqueue each opportunity into acting-queue</p>
<p>for (const opp of inserted) {</p>
<p>await sqsClient.send(new SendMessageCommand({</p>
<p>QueueUrl: process.env.ACTING_QUEUE_URL,</p>
<p>MessageBody: JSON.stringify({ opportunityId: opp.id }),</p>
<p>MessageDeduplicationId: opp.id, // FIFO queue dedup</p>
<p>MessageGroupId: 'acting',</p>
<p>}));</p>
<p>}</p>
<p>};</p></td>
</tr>
</tbody>
</table>

**3.5 Acting Agent — Confidence Routing**

The Acting Agent runs per opportunity. It drafts content and scores its own output. Routing is deterministic — no randomness. The score threshold must be configurable per company type.

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// Acting Agent routing logic</p>
<p>const CONFIDENCE_THRESHOLDS = {</p>
<p>service_company: { auto: 0.88, review: 0.65 }, // AppGambit — quality bar higher</p>
<p>saas_founder: { auto: 0.82, review: 0.60 },</p>
<p>solo_creator: { auto: 0.85, review: 0.62 },</p>
<p>};</p>
<p>// After Acting Agent returns:</p>
<p>async function routeDraft(draft: DraftedContent, companyType: string) {</p>
<p>const thresholds = CONFIDENCE_THRESHOLDS[companyType];</p>
<p>if (draft.confidenceScore &gt;= thresholds.auto) {</p>
<p>// Auto-queue — still requires human approval window (see section 5)</p>
<p>await db.update(draftedContent)</p>
<p>.set({ approvalStatus: 'pending', sourceTag: 'brain_dump' })</p>
<p>.where(eq(draftedContent.id, draft.id));</p>
<p>await enqueueForAutoApproval(draft.id);</p>
<p>} else if (draft.confidenceScore &gt;= thresholds.review) {</p>
<p>// Flagged for human review in approval UI</p>
<p>await db.update(draftedContent)</p>
<p>.set({ approvalStatus: 'pending' })</p>
<p>.where(eq(draftedContent.id, draft.id));</p>
<p>// No queue — surfaces in UI on next open</p>
<p>} else {</p>
<p>// Hold for Strategist — save with pending status, no queue</p>
<p>await db.update(draftedContent)</p>
<p>.set({ approvalStatus: 'pending', sourceTag: 'strategist_fallback' })</p>
<p>.where(eq(draftedContent.id, draft.id));</p>
<p>// Strategist will surface this on next weekly run</p>
<p>}</p>
<p>}</p>
<p>// IMPORTANT: Voice profile is built from skip reasons, not just approvals</p>
<p>// Every skip with a reason updates the voice profile in S3</p>
<p>// Acting Agent loads the voice profile on every invocation</p>
<p>// Format: s3://shiploop-assets/voice-profile/{userId}/profile.json</p></td>
</tr>
</tbody>
</table>

**4. SST v4 Configuration**

**4.1 Project Structure**

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>shiploop/</p>
<p>├── sst.config.ts # SST v4 Ion config</p>
<p>├── packages/</p>
<p>│ ├── core/ # Shared — DB, schema, utilities</p>
<p>│ │ ├── src/</p>
<p>│ │ │ ├── schema.ts # Drizzle schema</p>
<p>│ │ │ ├── db.ts # Neon HTTP client</p>
<p>│ │ │ ├── db-pool.ts # Pooled client for Step Functions</p>
<p>│ │ │ └── agents/</p>
<p>│ │ │ ├── noticing.ts # Noticing agent logic</p>
<p>│ │ │ ├── acting.ts # Acting agent logic</p>
<p>│ │ │ └── prompts/ # System prompts as .md files</p>
<p>│ └── web/ # Next.js App Router</p>
<p>│ ├── app/</p>
<p>│ │ ├── api/ # API routes</p>
<p>│ │ │ ├── dump/route.ts # Brain dump submission</p>
<p>│ │ │ ├── approval/ # Approval queue API</p>
<p>│ │ │ └── assets/ # Asset registry API</p>
<p>│ │ └── (ui)/ # App pages</p>
<p>├── functions/ # Lambda handlers</p>
<p>│ ├── noticing-agent.ts</p>
<p>│ ├── acting-agent.ts</p>
<p>│ ├── posting-agent.ts</p>
<p>│ ├── strategist-hydrate.ts</p>
<p>│ ├── strategist-start-session.ts</p>
<p>│ ├── strategist-poll-session.ts</p>
<p>│ └── strategist-persist.ts</p>
<p>├── agents/ # ant CLI agent definitions</p>
<p>│ ├── strategist.yaml</p>
<p>│ └── reviewing.yaml</p>
<p>└── infra/ # SST resource definitions</p>
<p>├── queues.ts</p>
<p>├── step-functions.ts</p>
<p>└── secrets.ts</p></td>
</tr>
</tbody>
</table>

**4.2 sst.config.ts — Key Resources**

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// sst.config.ts</p>
<p>export default $config({</p>
<p>app(input) {</p>
<p>return {</p>
<p>name: 'shiploop',</p>
<p>removal: input?.stage === 'production' ? 'retain' : 'remove',</p>
<p>home: 'aws',</p>
<p>providers: { aws: { region: 'ap-south-1' } },</p>
<p>};</p>
<p>},</p>
<p>async run() {</p>
<p>// ── Secrets ─────────────────────────────────────────</p>
<p>const dbUrl = new sst.Secret('DatabaseUrl');</p>
<p>const dbPoolUrl = new sst.Secret('DatabasePoolUrl');</p>
<p>const anthropicKey = new sst.Secret('AnthropicApiKey');</p>
<p>const openrouterKey = new sst.Secret('OpenRouterApiKey');</p>
<p>const strategistAgentId = new sst.Secret('StrategistAgentId');</p>
<p>const reviewingAgentId = new sst.Secret('ReviewingAgentId');</p>
<p>// ── S3 ──────────────────────────────────────────────</p>
<p>const assetsBucket = new sst.aws.Bucket('AssetsBucket');</p>
<p>// Stores: voice dumps, Strategist context JSONs, voice profiles</p>
<p>// ── SQS Queues ───────────────────────────────────────</p>
<p>const noticingQueue = new sst.aws.Queue('NoticingQueue', {</p>
<p>fifo: true, // Exactly-once processing</p>
<p>visibilityTimeout: '5 minutes',</p>
<p>});</p>
<p>const actingQueue = new sst.aws.Queue('ActingQueue', {</p>
<p>fifo: true,</p>
<p>visibilityTimeout: '3 minutes',</p>
<p>});</p>
<p>const postingQueue = new sst.aws.Queue('PostingQueue', {</p>
<p>fifo: true,</p>
<p>visibilityTimeout: '2 minutes',</p>
<p>});</p>
<p>// ── DynamoDB ─────────────────────────────────────────</p>
<p>const stateTable = new sst.aws.Dynamo('StateTable', {</p>
<p>fields: { pk: 'string', sk: 'string' },</p>
<p>primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },</p>
<p>ttl: 'ttl',</p>
<p>});</p>
<p>// ── Lambda Functions ─────────────────────────────────</p>
<p>const commonEnv = {</p>
<p>DATABASE_URL: dbUrl.value,</p>
<p>STATE_TABLE_NAME: stateTable.name,</p>
<p>ASSETS_BUCKET: assetsBucket.name,</p>
<p>};</p>
<p>const noticingFn = new sst.aws.Function('NoticingAgent', {</p>
<p>handler: 'functions/noticing-agent.handler',</p>
<p>architecture: 'arm64',</p>
<p>timeout: '4 minutes',</p>
<p>memory: '512 MB',</p>
<p>environment: {</p>
<p>...commonEnv,</p>
<p>OPENROUTER_API_KEY: openrouterKey.value,</p>
<p>ACTING_QUEUE_URL: actingQueue.url,</p>
<p>},</p>
<p>});</p>
<p>noticingQueue.subscribe(noticingFn.arn);</p>
<p>const actingFn = new sst.aws.Function('ActingAgent', {</p>
<p>handler: 'functions/acting-agent.handler',</p>
<p>architecture: 'arm64',</p>
<p>timeout: '6 minutes',</p>
<p>memory: '512 MB',</p>
<p>environment: {</p>
<p>...commonEnv,</p>
<p>OPENROUTER_API_KEY: openrouterKey.value,</p>
<p>POSTING_QUEUE_URL: postingQueue.url,</p>
<p>},</p>
<p>});</p>
<p>actingQueue.subscribe(actingFn.arn);</p>
<p>// ── Step Functions (Strategist) ───────────────────────</p>
<p>// Defined in infra/step-functions.ts</p>
<p>// Triggered by EventBridge cron: every Sunday 8pm IST</p>
<p>// ── Next.js App ───────────────────────────────────────</p>
<p>const web = new sst.aws.Nextjs('Web', {</p>
<p>path: 'packages/web',</p>
<p>environment: {</p>
<p>...commonEnv,</p>
<p>NOTICING_QUEUE_URL: noticingQueue.url,</p>
<p>},</p>
<p>});</p>
<p>return { url: web.url };</p>
<p>}</p>
<p>});</p></td>
</tr>
</tbody>
</table>

**5. Known Implementation Traps — Pre-empted**

These are the issues that will appear during build if not addressed upfront. Each has been seen in production AWS serverless systems. Pre-empting them saves days of debugging.

|  |  |  |
|----|----|----|
| **Issue** | **What Happens** | **How We Solve It** |
| **SQS + Neon cold start on cron** | Reviewing Agent cron fires at 2am. Lambda cold starts. First Neon HTTP query takes 500ms. If Lambda timeout is short, first invocation fails. SQS retries after visibility timeout. Message processed twice. | Set Lambda timeout to minimum 3 minutes for all agent functions. Add DynamoDB idempotency check as first line of every handler before any DB work. |
| **FIFO SQS message ordering** | Acting Agent processes opportunities from the same brain dump out of order. Two opportunities from the same dump get different Strategist directive snapshots if directives update mid-processing. | MessageGroupId = inputDumpId for all opportunities from the same dump. This serialises processing per dump. |
| **Step Functions + Lambda 15min wall** | Strategist session runs for 18 minutes. PollSessionCompletion Lambda times out. Step Functions marks execution as failed. | Heartbeat pattern — Lambda polls for 12 min max, returns in_progress to Step Functions, which re-invokes with accumulated state. See section 3.3. |
| **Managed Agent session idle timeout** | If the Strategist session has no activity for a period, Anthropic may close it. Polling resumes but the session is gone. | Poll session status before streaming. If session is closed, read accumulated tool_use output from DynamoDB session tracking record. Persist partial state, notify for manual review. |
| **Neon branch per PR strategy** | Running integration tests against production Postgres causes data contamination. Developers skip tests because setting up test DB is hard. | Use Neon branching in CI. Each PR gets a Neon branch via GitHub Actions. Branch deleted on PR close. Zero manual DB management. |
| **OpenRouter rate limits** | Acting Agent processes 10 opportunities from one brain dump simultaneously. All 10 hit OpenRouter Sonnet at the same time. Rate limit hit. 5 fail. | Add exponential backoff wrapper around all OpenRouter calls. Set FIFO queue concurrency to 3 per group to limit parallel Acting Agent invocations. |
| **Approval UI stale state** | User opens approval queue. Two drafts shown. User approves first. In another tab, the Strategist fallback runs and adds 3 more drafts. User's current session is stale. | Approval queue uses server-sent events to push new drafts in real-time. Next.js route handler streams SSE to the approval UI. No polling. |
| **Voice dump Whisper timeout** | User submits 3-minute voice note. Lambda invoked synchronously from API route. Whisper transcription takes 90 seconds. API Gateway times out at 29 seconds. | Voice upload goes directly to S3 via presigned URL. S3 event triggers Noticing Lambda asynchronously. API returns 202 immediately. UI polls for completion status. |

**6. Environments and Deployment**

**6.1 Environment Strategy**

|  |  |
|----|----|
| **dev** | Local Next.js dev server + SST dev tunnel for Lambda. Neon dev branch. Uses personal OpenRouter key. No Managed Agent sessions — stub responses only. |
| **staging** | Full AWS deploy. Neon staging branch (forked from prod schema). Real Managed Agent sessions. EventBridge crons disabled — trigger manually via AWS console. |
| **production** | ap-south-1 (Mumbai) for low latency from Ahmedabad. Neon production database. All crons active. Alerts via EventBridge → SNS → email. |

**6.2 Secrets Management**

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p># Set secrets for each stage</p>
<p>npx sst secret set DatabaseUrl 'postgresql://...' --stage production</p>
<p>npx sst secret set DatabasePoolUrl 'postgresql://...pooler...' --stage production</p>
<p>npx sst secret set AnthropicApiKey 'sk-ant-...' --stage production</p>
<p>npx sst secret set OpenRouterApiKey 'sk-or-...' --stage production</p>
<p>npx sst secret set StrategistAgentId 'agent_01...' --stage production</p>
<p>npx sst secret set ReviewingAgentId 'agent_01...' --stage production</p>
<p># Agent IDs are created via ant CLI and stored as secrets</p>
<p>ant agents create --file agents/strategist.yaml</p>
<p># Returns agent_id — store in SST secret</p></td>
</tr>
</tbody>
</table>

**6.3 EventBridge Cron Schedule**

<table style="width:97%;">
<colgroup>
<col style="width: 97%" />
</colgroup>
<tbody>
<tr>
<td><p>// infra/crons.ts</p>
<p>new sst.aws.Cron('StrategistWeekly', {</p>
<p>schedule: 'cron(30 14 ? * SUN *)', // Sunday 8pm IST = 14:30 UTC</p>
<p>job: {</p>
<p>handler: 'functions/strategist-trigger.handler',</p>
<p>environment: { STEP_FUNCTION_ARN: strategistWorkflow.arn }</p>
<p>}</p>
<p>});</p>
<p>new sst.aws.Cron('ReviewingWeekly', {</p>
<p>schedule: 'cron(0 20 ? * SAT *)', // Saturday 1:30am IST = Saturday 8pm UTC</p>
<p>job: {</p>
<p>handler: 'functions/reviewing-trigger.handler',</p>
<p>environment: { STEP_FUNCTION_ARN: reviewingWorkflow.arn }</p>
<p>}</p>
<p>});</p>
<p>new sst.aws.Cron('EngagementPoll', {</p>
<p>schedule: 'rate(12 hours)', // Poll Reddit .json and LinkedIn every 12h</p>
<p>job: { handler: 'functions/engagement-poller.handler' }</p>
<p>});</p></td>
</tr>
</tbody>
</table>

**7. Phase 1 Build Checklist**

Ordered by dependency. Each item is a single completable unit. Nothing marked as Phase 1 touches Claude Managed Agents — validate the core loop first.

|  |  |  |  |
|----|----|----|----|
| **#** | **Task** | **Definition of Done** | **Phase** |
| **1** | **SST project scaffold** | sst dev runs. Next.js loads at localhost. No errors. | **P1** |
| **2** | **Neon DB + Drizzle** | drizzle-kit push succeeds against Neon dev branch. All tables and enums created. | **P1** |
| **3** | **User config + onboarding** | POST /api/onboard saves user_config row. GET /api/config returns it. | **P1** |
| **4** | **Asset registry CRUD** | Create, read, update assets via API. Assets listed on /assets page. | **P1** |
| **5** | **Brain dump text intake** | POST /api/dump creates input_dump row. Returns 202. SQS message enqueued. | **P1** |
| **6** | **Noticing Agent Lambda** | Lambda processes SQS message. Calls OpenRouter Sonnet. Writes opportunities to DB. Enqueues to acting-queue. | **P1** |
| **7** | **Acting Agent Lambda** | Lambda processes opportunity. Calls OpenRouter Sonnet (draft call + separate score call). Writes drafted_content with source_tag, confidence_score, and platform-structured output. | **P1** |
| **8** | **Approval queue UI** | Card-based UI shows pending drafts. Source tag visible. Approve/Edit/Skip with reason all work. Skip reason and edit diffs write to voice_profile_entries. | **P1** |
| **9** | **Manual posting flow** | After approval, human copies platform-structured content, posts manually, reports back with post URL. posted_content row created with post_url. | **P1** |
| **10** | **Voice profile entries** | Approved/edited/skipped drafts create voice_profile_entries rows with per-platform separation, diff categories, and recency weights. | **P1** |
| **11** | **Voice input + Whisper** | Voice note uploaded to S3 via presigned URL. S3 event triggers transcription. Transcript populates input_dump. | **P2** |
| **12** | **Strategist Step Functions** | Step Functions state machine runs. Managed Agent session created. Directives written to strategist_memory. | **P2** |
| **13** | **Reviewing Step Functions** | Weekly cron triggers reviewing workflow. Engagement data pulled. Signal summary generated. | **P2** |
| **14** | **Launch Mode** | Manual activate/deactivate. Noticing polling on 30-min interval. Rapid-fire approval UI. | **P3** |
| **15** | **Burnout Protocol** | Silence threshold check in Strategist run. Evergreen bank draw on threshold breach. | **P3** |
| **16** | **Competitor monitoring** | Reviewing Agent scrapes competitor URLs. Surfaces to Strategist. | **P3** |

|  |  |
|:--:|----|
| **RULE** | Do not touch Phase 2 until all 10 Phase 1 items have a working definition of done in staging. The Strategist agent cannot be meaningfully tested without real posts and real signals. |

**SHIPLOOP — IMPLEMENTATION SPEC**

*AWS Serverless + SST v4 + Claude Managed Agents*

v1.0 — AppGambit, April 2026
