export interface StrategistDirectives {
  channelWeights: Record<string, number>;
  contentAngleDefaults: string[];
  priorityAssetIds: string[];
  silenceAlarm: boolean;
  urgencyOverrides: Record<string, string>;
}

export interface StrategistRunResult {
  sessionId: string;
  monologue: string | null;
  directives: StrategistDirectives | null;
  narrativeAssessment: string | null;
  driftScore: number | null;
  pathSimulation: { pathA: string; pathB: string } | null;
  agentMessages: string[];
  toolCallsLog: Array<{ tool: string; input: unknown; timestamp: string }>;
  error: string | null;
  durationMs: number;
}
