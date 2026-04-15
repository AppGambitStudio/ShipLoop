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
  status: string;
  createdAt: string;
}

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: "LinkedIn", color: "bg-blue-600/20 text-blue-400" },
  twitter: { label: "Twitter", color: "bg-gray-600/20 text-gray-300" },
  x: { label: "X", color: "bg-gray-600/20 text-gray-300" },
  reddit: { label: "Reddit", color: "bg-orange-600/20 text-orange-400" },
  hackernews: { label: "HN", color: "bg-amber-600/20 text-amber-400" },
  hn: { label: "HN", color: "bg-amber-600/20 text-amber-400" },
  slack: { label: "Slack", color: "bg-purple-600/20 text-purple-400" },
  discord: { label: "Discord", color: "bg-indigo-600/20 text-indigo-400" },
};

const SKIP_REASONS = [
  { value: "tone_wrong", label: "Tone wrong" },
  { value: "angle_wrong", label: "Angle wrong" },
  { value: "timing_wrong", label: "Timing wrong" },
  { value: "too_generic", label: "Too generic" },
  { value: "other", label: "Other" },
];

function confidenceBadge(score: number) {
  if (score >= 80) return "bg-green-500/15 text-green-400";
  if (score >= 60) return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

function DraftCard({
  draft,
  onAction,
}: {
  draft: Draft;
  onAction: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "skip">("view");
  const [editedContent, setEditedContent] = useState(draft.content);
  const [skipReason, setSkipReason] = useState("tone_wrong");
  const [skipText, setSkipText] = useState("");
  const [busy, setBusy] = useState(false);

  const platform =
    PLATFORM_STYLES[draft.platform?.toLowerCase()] ||
    { label: draft.platform || "Unknown", color: "bg-gray-600/20 text-gray-400" };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await api.drafts.approve(draft.id);
      onAction();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async () => {
    setBusy(true);
    try {
      await api.drafts.edit(draft.id, editedContent);
      onAction();
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setMode("view");
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await api.drafts.skip(
        draft.id,
        skipReason,
        skipReason === "other" ? skipText : undefined
      );
      onAction();
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setMode("view");
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${platform.color}`}>
          {platform.label}
        </span>
        {draft.target && (
          <span className="text-xs text-gray-500">{draft.target}</span>
        )}
        {draft.confidenceScore != null && (
          <span
            className={`ml-auto rounded-md px-2.5 py-1 text-xs font-medium ${confidenceBadge(
              draft.confidenceScore
            )}`}
          >
            {draft.confidenceScore}%
          </span>
        )}
      </div>

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
        <p className="text-xs text-gray-500 italic mb-4">
          {draft.reasoning}
        </p>
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
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
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
            <button
              onClick={handleApprove}
              disabled={busy}
              className="rounded-lg bg-green-600/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => setMode("edit")}
              className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setMode("skip")}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              Skip
            </button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button
              onClick={handleEdit}
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              Save Edit
            </button>
            <button
              onClick={() => {
                setMode("view");
                setEditedContent(draft.content);
              }}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
        {mode === "skip" && (
          <>
            <button
              onClick={handleSkip}
              disabled={busy}
              className="rounded-lg bg-gray-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-500 disabled:opacity-50 transition-colors"
            >
              Confirm Skip
            </button>
            <button
              onClick={() => setMode("view")}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function QueuePage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrafts = useCallback(async () => {
    try {
      const data = await api.drafts.pending();
      setDrafts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadDrafts();

    const interval = setInterval(loadDrafts, 10000);
    return () => clearInterval(interval);
  }, [router, loadDrafts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review AI-generated drafts before they go live.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-[#0d0d12] p-10 text-center">
          <p className="text-gray-500">No drafts pending.</p>
          <p className="text-sm text-gray-600 mt-1">
            Submit a brain dump to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} onAction={loadDrafts} />
          ))}
        </div>
      )}
    </div>
  );
}
