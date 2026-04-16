"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface VoiceStats {
  totalEntries: number;
  approvalRate: number;
  byType: { approved: number; edits: number; skips: number };
  byPlatform: Record<string, { approved: number; edits: number; skips: number; total: number; latest: string | null }>;
  maturity: string;
}

interface VoiceEntry {
  id: string;
  platform: string;
  entryType: string;
  originalContent: string | null;
  finalContent: string | null;
  diffCategories: Record<string, unknown> | null;
  skipReason: string | null;
  weight: number;
  createdAt: string;
}

const maturityConfig: Record<string, { label: string; color: string; desc: string }> = {
  learning: { label: "Learning", color: "text-yellow-400", desc: "The engine is still learning your voice. Keep approving, editing, and skipping to train it." },
  developing: { label: "Developing", color: "text-cyan-400", desc: "Your voice profile is taking shape. Edits are the strongest signal — keep refining." },
  maturing: { label: "Maturing", color: "text-green-400", desc: "The engine is getting good at matching your voice. Approval rate should be climbing." },
  mature: { label: "Mature", color: "text-green-300", desc: "Strong voice profile. The engine should sound like you most of the time." },
};

const entryTypeConfig: Record<string, { label: string; color: string }> = {
  approved_post: { label: "Approved", color: "bg-green-500/10 text-green-400" },
  edit_diff: { label: "Edited", color: "bg-cyan-500/10 text-cyan-400" },
  skip_signal: { label: "Skipped", color: "bg-gray-500/10 text-gray-400" },
  engagement_signal: { label: "Engagement", color: "bg-purple-500/10 text-purple-400" },
};

export default function VoiceProfilePage() {
  const router = useRouter();
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [s, e] = await Promise.all([
        api.voiceProfile.stats(),
        api.voiceProfile.recent(20),
      ]);
      setStats(s);
      setEntries(e);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading voice profile...</p>
      </div>
    );
  }

  const maturity = stats ? maturityConfig[stats.maturity] || maturityConfig.learning : maturityConfig.learning;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Voice Profile</h1>
      <p className="text-sm text-gray-500 mb-6">
        How well the engine knows your voice. Every approve, edit, and skip teaches it.
      </p>

      {stats && (
        <>
          {/* Maturity Banner */}
          <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-lg font-bold font-mono ${maturity.color}`}>{maturity.label}</span>
              <span className="text-xs text-gray-600">{stats.totalEntries} signals collected</span>
            </div>
            <p className="text-sm text-gray-400">{maturity.desc}</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-4 text-center">
              <div className="text-2xl font-bold font-mono text-green-400">{stats.approvalRate}%</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Approval Rate</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-4 text-center">
              <div className="text-2xl font-bold font-mono text-green-400">{stats.byType.approved}</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Approved</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-4 text-center">
              <div className="text-2xl font-bold font-mono text-cyan-400">{stats.byType.edits}</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Edited</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-4 text-center">
              <div className="text-2xl font-bold font-mono text-gray-400">{stats.byType.skips}</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Skipped</div>
            </div>
          </div>

          {/* Per-Platform Breakdown */}
          {Object.keys(stats.byPlatform).length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Per Platform</h2>
              <div className="space-y-2">
                {Object.entries(stats.byPlatform).map(([platform, data]) => {
                  const total = data.approved + data.edits + data.skips;
                  const rate = total > 0 ? Math.round(((data.approved + data.edits) / total) * 100) : 0;
                  return (
                    <div key={platform} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#0d0d12] p-3">
                      <span className="text-xs font-mono text-gray-300 w-24">{platform}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-mono w-16 text-right">{rate}% ({data.total})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Recent Activity */}
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">No voice profile activity yet. Approve, edit, or skip drafts to start training.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const type = entryTypeConfig[entry.entryType] || entryTypeConfig.approved_post;
            return (
              <div key={entry.id} className="rounded-lg border border-white/5 bg-[#0d0d12] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${type.color}`}>{type.label}</span>
                  <span className="text-[10px] text-gray-600 font-mono">{entry.platform}</span>
                  <span className="text-[10px] text-gray-700 font-mono ml-auto">
                    wt: {entry.weight.toFixed(1)} | {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {entry.entryType === "edit_diff" && entry.diffCategories && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(entry.diffCategories).map(([key, val]) => {
                      if (key === "summary") return null;
                      if (typeof val === "boolean" && !val) return null;
                      return (
                        <span key={key} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
                          {key === "length_change" ? `length: ${val}` : key.replace("_", " ")}
                        </span>
                      );
                    })}
                    {(entry.diffCategories as any).summary && (
                      <span className="text-[10px] text-gray-500 italic ml-1">{(entry.diffCategories as any).summary}</span>
                    )}
                  </div>
                )}
                {entry.entryType === "skip_signal" && entry.skipReason && (
                  <p className="text-[10px] text-gray-500">Reason: {entry.skipReason.replace("_", " ")}</p>
                )}
                {entry.finalContent && (
                  <p className="text-xs text-gray-400 line-clamp-2 font-mono">{entry.finalContent}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
