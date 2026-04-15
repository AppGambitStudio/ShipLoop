import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  real,
  jsonb,
  date,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────

export const companyType = pgEnum("company_type", [
  "service_company",
  "saas_founder",
  "solo_creator",
  "indie_builder",
]);

export const assetCategory = pgEnum("asset_category", [
  "open_source",
  "product",
  "content",
  "talk",
]);

export const distributionStatus = pgEnum("distribution_status", [
  "undistributed",
  "in_progress",
  "distributed",
  "amplified",
]);

export const inputSource = pgEnum("input_source", ["text", "voice"]);

export const emotionalState = pgEnum("emotional_state", [
  "neutral",
  "stressed",
  "excited",
]);

export const urgencyEnum = pgEnum("urgency", ["high", "medium", "low"]);

export const platformEnum = pgEnum("platform", [
  "reddit",
  "linkedin",
  "twitter",
  "youtube",
  "newsletter",
  "github_readme",
  "hackernews",
  "indiehackers",
  "devto",
  "other",
]);

export const contentSource = pgEnum("content_source", [
  "brain_dump",
  "strategist_fallback",
  "signal_amplification",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "edited",
  "skipped",
  "expired",
]);

export const skipReasonEnum = pgEnum("skip_reason", [
  "tone_wrong",
  "angle_wrong",
  "timing_wrong",
  "too_generic",
  "other",
]);

export const tractionFlag = pgEnum("traction_flag", [
  "none",
  "some",
  "strong",
]);

export const competitorSignalType = pgEnum("competitor_signal_type", [
  "new_product",
  "viral_post",
  "pricing_change",
  "other",
]);

export const voiceEntryType = pgEnum("voice_entry_type", [
  "approved_post",
  "edit_diff",
  "skip_signal",
  "engagement_signal",
]);

// ── Tables ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userConfig = pgTable("user_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  companyType: companyType("company_type").notNull(),
  goalStatement: text("goal_statement").notNull(),
  channels: jsonb("channels").notNull(),
  signalDefinitions: jsonb("signal_definitions").notNull(),
  competitors: jsonb("competitors").default("[]"),
  silenceThresholdDays: integer("silence_threshold_days").default(7),
  burnoutProtocolDays: integer("burnout_protocol_days"),
  queueExpiryHours: integer("queue_expiry_hours").default(48),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  oneLiner: text("one_liner").notNull(),
  category: assetCategory("category").notNull(),
  githubUrl: text("github_url"),
  liveUrl: text("live_url"),
  targetAudience: text("target_audience").notNull(),
  distributionStatus: distributionStatus("distribution_status")
    .notNull()
    .default("undistributed"),
  lastDistributedAt: timestamp("last_distributed_at"),
  priorityScore: real("priority_score").notNull().default(0.5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inputDumps = pgTable("input_dumps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  rawText: text("raw_text").notNull(),
  source: inputSource("source").notNull().default("text"),
  voiceTranscript: text("voice_transcript"),
  voiceFilePath: text("voice_file_path"),
  emotionalState: emotionalState("emotional_state").default("neutral"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  inputDumpId: uuid("input_dump_id")
    .notNull()
    .references(() => inputDumps.id),
  assetId: uuid("asset_id").references(() => assets.id),
  description: text("description").notNull(),
  angle: text("angle").notNull(),
  urgency: urgencyEnum("urgency").notNull().default("medium"),
  relevanceScore: real("relevance_score").notNull(),
  suggestedChannels: jsonb("suggested_channels").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const draftedContent = pgTable("drafted_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  platform: platformEnum("platform").notNull(),
  target: text("target").notNull(),
  content: text("content").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  sourceTag: contentSource("source_tag").notNull(),
  approvalStatus: approvalStatus("approval_status")
    .notNull()
    .default("pending"),
  skipReason: skipReasonEnum("skip_reason"),
  skipReasonText: text("skip_reason_text"),
  approvedContent: text("approved_content"),
  approvedAt: timestamp("approved_at"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postedContent = pgTable("posted_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftedContentId: uuid("drafted_content_id")
    .notNull()
    .references(() => draftedContent.id),
  platformPostId: text("platform_post_id"),
  postedAt: timestamp("posted_at").notNull(),
  postUrl: text("post_url"),
  engagementLastChecked: timestamp("engagement_last_checked"),
  upvotes: integer("upvotes").default(0),
  comments: integer("comments").default(0),
  tractionFlag: tractionFlag("traction_flag").default("none"),
  isOutsideEngine: boolean("is_outside_engine").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const strategistMemory = pgTable("strategist_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  weekOf: date("week_of").notNull(),
  internalMonologue: text("internal_monologue").notNull(),
  directives: jsonb("directives").notNull(),
  priorityAssets: jsonb("priority_assets").notNull(),
  narrativeAssessment: text("narrative_assessment").notNull(),
  driftScore: real("drift_score").default(0),
  pathSimulation: jsonb("path_simulation"),
  goalsSnapshot: text("goals_snapshot").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const competitorSignals = pgTable("competitor_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  competitorName: text("competitor_name").notNull(),
  platform: text("platform").notNull(),
  signalType: competitorSignalType("signal_type").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
});

export const evergreenBank = pgTable("evergreen_bank", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  assetId: uuid("asset_id").references(() => assets.id),
  content: text("content").notNull(),
  platform: platformEnum("platform").notNull(),
  approvedAt: timestamp("approved_at").notNull(),
  timesUsed: integer("times_used").default(0),
  lastUsedAt: timestamp("last_used_at"),
});

export const voiceProfileEntries = pgTable("voice_profile_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  platform: platformEnum("platform").notNull(),
  entryType: voiceEntryType("entry_type").notNull(),
  draftedContentId: uuid("drafted_content_id").references(
    () => draftedContent.id
  ),
  originalContent: text("original_content"),
  finalContent: text("final_content"),
  diffCategories: jsonb("diff_categories"),
  skipReason: skipReasonEnum("skip_reason"),
  engagementScore: real("engagement_score"),
  weight: real("weight").notNull().default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
