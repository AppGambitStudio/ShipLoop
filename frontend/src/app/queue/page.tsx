"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Draft {
  id: string;
  platform: string;
  target: string;
  content: string;
  reasoning: string;
  confidenceScore: number;
  sourceTag: string;
  createdAt: string;
  description: string;
  angle: string;
  dumpCreatedAt: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  edited: number;
  skipped: number;
  expired: number;
}

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: "LinkedIn", color: "bg-blue-600/20 text-blue-400" },
  twitter: { label: "Twitter/X", color: "bg-gray-600/20 text-gray-300" },
  reddit: { label: "Reddit", color: "bg-orange-600/20 text-orange-400" },
  hackernews: { label: "HN", color: "bg-amber-600/20 text-amber-400" },
  indiehackers: { label: "IndieHackers", color: "bg-teal-600/20 text-teal-400" },
  youtube: { label: "YouTube", color: "bg-red-600/20 text-red-400" },
  newsletter: { label: "Newsletter", color: "bg-purple-600/20 text-purple-400" },
  devto: { label: "Dev.to", color: "bg-gray-600/20 text-gray-300" },
  github_readme: { label: "GitHub", color: "bg-gray-600/20 text-gray-300" },
};

const SKIP_REASONS = [
  { value: "tone_wrong", label: "Tone wrong" },
  { value: "angle_wrong", label: "Angle wrong" },
  { value: "timing_wrong", label: "Timing wrong" },
  { value: "too_generic", label: "Too generic" },
  { value: "other", label: "Other" },
];

function confidenceBadge(score: number) {
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 80) return { cls: "bg-green-500/15 text-green-400", pct };
  if (pct >= 60) return { cls: "bg-yellow-500/15 text-yellow-400", pct };
  return { cls: "bg-red-500/15 text-red-400", pct };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function DraftCard({ draft, onAction }: { draft: Draft; onAction: () => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "skip" | "post_url">("view");
  const [editedContent, setEditedContent] = useState(draft.content);
  const [skipReason, setSkipReason] = useState("tone_wrong");
  const [skipText, setSkipText] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const platform =
    PLATFORM_STYLES[draft.platform?.toLowerCase()] ||
    { label: draft.platform || "Unknown", color: "bg-gray-600/20 text-gray-400" };

  const score = confidenceBadge(draft.confidenceScore);

  const handleApprove = async () => {
    setBusy(true); setError("");
    try {
      await api.drafts.approve(draft.id);
      setMode("post_url"); // Show URL input after approving
    }
    catch (err: any) { setError(err.message || "Approve failed"); }
    finally { setBusy(false); }
  };

  const handlePostUrl = async () => {
    if (postUrl.trim()) {
      setBusy(true); setError("");
      try {
        await api.posted.report(draft.id, postUrl.trim());
      } catch (err: any) {
        setError(err.message || "Failed to save post URL");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    // Whether URL was entered or skipped, remove from queue
    onAction();
  };

  const handleEdit = async () => {
    setBusy(true); setError("");
    try {
      await api.drafts.edit(draft.id, editedContent);
      setMode("post_url"); // Show URL input after edit+approve too
    }
    catch (err: any) { setError(err.message || "Edit failed"); }
    finally { setBusy(false); }
  };

  const handleSkip = async () => {
    setBusy(true); setError("");
    try { await api.drafts.skip(draft.id, skipReason, skipReason === "other" ? skipText : undefined); onAction(); }
    catch (err: any) { setError(err.message || "Skip failed"); }
    finally { setBusy(false); setMode("view"); }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${platform.color}`}>
          {platform.label}
        </span>
        {draft.target && draft.target !== "main" && (
          <span className="text-xs text-gray-500 font-mono">{draft.target}</span>
        )}
        <span className="text-xs text-gray-600 font-mono">{draft.angle}</span>
        {draft.sourceTag && (
          <span className="text-[10px] text-gray-700 bg-white/5 px-1.5 py-0.5 rounded font-mono">
            {draft.sourceTag.replace("_", " ")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-600">{timeAgo(draft.createdAt)}</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium font-mono ${score.cls}`}>
            {score.pct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Opportunity context */}
      <p className="text-xs text-gray-500 mb-2 border-l-2 border-white/5 pl-3">
        {draft.description}
      </p>

      {/* Content */}
      {mode === "edit" ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors resize-y mb-3"
        />
      ) : (
        <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3 leading-relaxed">
          {draft.content}
        </p>
      )}

      {/* Reasoning */}
      {draft.reasoning && mode === "view" && (
        <p className="text-xs text-gray-500 italic mb-4">{draft.reasoning}</p>
      )}

      {/* Skip reason selector */}
      {mode === "skip" && (
        <div className="mb-3 space-y-2">
          <select
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 outline-none"
          >
            {SKIP_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {skipReason === "other" && (
            <input
              value={skipText}
              onChange={(e) => setSkipText(e.target.value)}
              placeholder="Tell us more..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {mode === "view" && (
          <>
            <button onClick={handleApprove} disabled={busy}
              className="rounded-lg bg-green-600/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
              Approve
            </button>
            <button onClick={() => setMode("edit")}
              className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 transition-colors">
              Edit
            </button>
            <button onClick={() => setMode("skip")}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
              Skip
            </button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button onClick={handleEdit} disabled={busy}
              className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors">
              Save & Approve
            </button>
            <button onClick={() => { setMode("view"); setEditedContent(draft.content); }}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
          </>
        )}
        {mode === "skip" && (
          <>
            <button onClick={handleSkip} disabled={busy}
              className="rounded-lg bg-gray-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-500 disabled:opacity-50 transition-colors">
              Confirm Skip
            </button>
            <button onClick={() => setMode("view")}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
          </>
        )}
        {mode === "post_url" && (
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-green-400 font-medium">Approved.</span>
              <span className="text-xs text-gray-500">Now post it and paste the URL:</span>
            </div>
            <div className="flex gap-2">
              <input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://linkedin.com/posts/..."
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
              />
              <button onClick={handlePostUrl} disabled={busy}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                {postUrl.trim() ? "Save URL" : "Skip for now"}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

export default function QueuePage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrafts = useCallback(async (newOffset = offset) => {
    try {
      const [data, s] = await Promise.all([
        api.drafts.pending(PAGE_SIZE, newOffset),
        api.drafts.stats(),
      ]);
      setDrafts(data.drafts);
      setTotal(data.total);
      setStats(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset]);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadDrafts(0);
    const interval = setInterval(() => loadDrafts(), 15000);
    return () => clearInterval(interval);
  }, [router, loadDrafts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const goToPage = (newOffset: number) => {
    setOffset(newOffset);
    setLoading(true);
    loadDrafts(newOffset);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const statItems = stats ? [
    { label: "Total", value: stats.total, color: "text-gray-300" },
    { label: "Pending", value: stats.pending, color: "text-yellow-400" },
    { label: "Approved", value: stats.approved + stats.edited, color: "text-green-400" },
    { label: "Skipped", value: stats.skipped, color: "text-gray-500" },
  ] : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review, edit, or skip AI-generated drafts.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {refreshing ? "..." : "Refresh"}
        </button>
      </div>

      {/* Stats Banner */}
      {stats && stats.total > 0 && (
        <div className="flex gap-4 mb-6 p-3 rounded-xl border border-white/5 bg-[#0d0d12]">
          {statItems.map((s) => (
            <div key={s.label} className="text-center flex-1">
              <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Drafts */}
      {loading ? (
        <p className="text-sm text-gray-600">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-10 text-center">
          <p className="text-gray-500">No drafts pending.</p>
          <p className="text-sm text-gray-600 mt-1">Submit a brain dump to get started.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} onAction={() => loadDrafts()} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => goToPage(offset - PAGE_SIZE)}
                disabled={offset === 0}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 font-mono">
                Page {currentPage} of {totalPages} ({total} pending)
              </span>
              <button
                onClick={() => goToPage(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
