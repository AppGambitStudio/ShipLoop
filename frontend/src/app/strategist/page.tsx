"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface StrategistEntry {
  id: string;
  weekOf: string;
  internalMonologue: string;
  directives: any;
  priorityAssets: any;
  narrativeAssessment: string;
  driftScore: number;
  pathSimulation: any;
  goalsSnapshot: string;
  createdAt: string;
}

interface HistoryEntry {
  id: string;
  weekOf: string;
  narrativeAssessment: string;
  driftScore: number;
  createdAt: string;
}

function driftColor(score: number): string {
  if (score <= 0.2) return "text-green-400";
  if (score <= 0.4) return "text-yellow-400";
  return "text-red-400";
}

function driftLabel(score: number): string {
  if (score <= 0.2) return "On track";
  if (score <= 0.4) return "Moderate drift";
  return "Significant drift";
}

export default function StrategistPage() {
  const router = useRouter();
  const [latest, setLatest] = useState<StrategistEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runType, setRunType] = useState<"weekly" | "quarterly">("weekly");
  const [runStatus, setRunStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [l, h] = await Promise.all([
        api.strategist.latest(),
        api.strategist.history(),
      ]);
      setLatest(l);
      setHistory(h);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setRunStatus("Starting Strategist run...");

    try {
      await api.strategist.run(runType);
      setRunStatus(`${runType} run started. This may take 1-3 minutes. Refresh to see results.`);

      // Poll for completion every 15s
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const l = await api.strategist.latest();
          if (l && (!latest || l.createdAt !== latest.createdAt)) {
            clearInterval(poll);
            setLatest(l);
            setRunning(false);
            setRunStatus("Strategist run complete.");
            loadData();
          }
        } catch { /* ignore */ }
        if (attempts > 20) { // 5 min timeout
          clearInterval(poll);
          setRunning(false);
          setRunStatus("Run may still be processing. Refresh the page to check.");
        }
      }, 15000);
    } catch (err: any) {
      setError(err.message || "Failed to start Strategist run");
      setRunning(false);
      setRunStatus("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading Strategist data...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Strategist</h1>
      <p className="text-sm text-gray-500 mb-6">
        The brain of the engine. Reasons over your accumulated data and issues directives.
      </p>

      {/* Run Trigger */}
      <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Trigger a Run</h2>
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
            <button
              onClick={() => setRunType("weekly")}
              className={`px-3 py-1.5 transition-colors ${runType === "weekly" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setRunType("quarterly")}
              className={`px-3 py-1.5 transition-colors ${runType === "quarterly" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Quarterly
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {runType === "weekly"
            ? "Analyzes last 30 days of posts and approvals. Issues directives for the next week."
            : "Deep 90-day review. Computes drift score against your original goal. May present two strategic paths."}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "Running..." : `Run ${runType} Analysis`}
          </button>
          {runStatus && <p className="text-xs text-gray-400">{runStatus}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {/* Latest Output */}
      {latest ? (
        <div className="space-y-4">
          {/* Drift Score */}
          <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300">Drift Score</h2>
              <span className="text-xs text-gray-600">{new Date(latest.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold font-mono ${driftColor(latest.driftScore)}`}>
                {(latest.driftScore * 100).toFixed(0)}%
              </span>
              <span className={`text-sm ${driftColor(latest.driftScore)}`}>{driftLabel(latest.driftScore)}</span>
            </div>
            <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${latest.driftScore <= 0.2 ? "bg-green-500" : latest.driftScore <= 0.4 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(latest.driftScore * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Narrative Assessment */}
          <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Narrative Assessment</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{latest.narrativeAssessment}</p>
          </div>

          {/* Directives */}
          {latest.directives && (
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Current Directives</h2>

              {latest.directives.channelWeights && (
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Channel Weights</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(latest.directives.channelWeights).map(([ch, w]) => (
                      <span key={ch} className="rounded-lg bg-white/5 px-3 py-1 text-xs font-mono text-gray-300">
                        {ch}: {((w as number) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latest.directives.contentAngleDefaults && (
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Content Angles (priority order)</h3>
                  <div className="flex flex-wrap gap-2">
                    {(latest.directives.contentAngleDefaults as string[]).map((angle, i) => (
                      <span key={angle} className="rounded-lg bg-cyan-500/10 px-3 py-1 text-xs font-mono text-cyan-400">
                        {i + 1}. {angle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latest.directives.silenceAlarm && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <p className="text-xs text-yellow-400 font-medium">Silence alarm active — builder has been quiet beyond threshold</p>
                </div>
              )}
            </div>
          )}

          {/* Internal Monologue */}
          {latest.internalMonologue && (
            <div className="rounded-xl border border-neon-purple/20 bg-[#0d0d12] p-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-300">Internal Monologue</h2>
                <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-mono">the engine thinking</span>
              </div>
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
                {latest.internalMonologue}
              </div>
            </div>
          )}

          {/* Path Simulation (quarterly) */}
          {latest.pathSimulation && (
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Strategic Fork Detected</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <h3 className="text-xs text-cyan-400 font-medium mb-2">Path A</h3>
                  <p className="text-xs text-gray-400">{latest.pathSimulation.pathA}</p>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                  <h3 className="text-xs text-purple-400 font-medium mb-2">Path B</h3>
                  <p className="text-xs text-gray-400">{latest.pathSimulation.pathB}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-10 text-center">
          <p className="text-gray-500">No Strategist runs yet.</p>
          <p className="text-sm text-gray-600 mt-1">Run your first weekly analysis to see the engine think.</p>
        </div>
      )}

      {/* Run History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Run History</h2>
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0d0d12] p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono">{entry.weekOf}</span>
                  <span className={`text-xs font-mono ${driftColor(entry.driftScore)}`}>
                    drift: {(entry.driftScore * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs text-gray-600">{new Date(entry.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
