"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Dump {
  id: string;
  rawText: string;
  processingStatus: string;
  processingError: string | null;
  emotionalState: string | null;
  createdAt: string;
  processedAt: string | null;
}

const PAGE_SIZE = 10;

export default function DumpPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dumps, setDumps] = useState<Dump[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingDumps, setLoadingDumps] = useState(true);
  const [expandedDumps, setExpandedDumps] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set());
  const [configMissing, setConfigMissing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadDumps(0);
    checkConfig();
    const interval = setInterval(() => loadDumps(), 10000);
    return () => clearInterval(interval);
  }, [router]);

  const checkConfig = async () => {
    try {
      const config = await api.config.get();
      setConfigMissing(!config);
    } catch {
      setConfigMissing(true);
    }
  };

  const loadDumps = async (newOffset?: number) => {
    const o = newOffset !== undefined ? newOffset : offset;
    try {
      const data = await api.dumps.list(PAGE_SIZE, o);
      setDumps(data.dumps);
      setTotal(data.total);
      if (newOffset !== undefined) setOffset(newOffset);
    } catch {
      // ignore
    } finally {
      setLoadingDumps(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      await api.dumps.submit(rawText);
      setSuccess(true);
      setRawText("");
      setOffset(0);
      loadDumps(0);
    } catch (err: any) {
      setError(err.message || "Failed to submit brain dump");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReprocess = async (dumpId: string) => {
    setReprocessing((prev) => new Set(prev).add(dumpId));
    try {
      await api.dumps.reprocess(dumpId);
      loadDumps();
    } catch (err: any) {
      setError(err.message || "Failed to reprocess");
    } finally {
      setReprocessing((prev) => {
        const next = new Set(prev);
        next.delete(dumpId);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDumps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToPage = (newOffset: number) => {
    setLoadingDumps(true);
    loadDumps(newOffset);
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-gray-500/10 text-gray-400" },
    processing: { label: "Processing...", color: "bg-yellow-500/10 text-yellow-400" },
    completed: { label: "Completed", color: "bg-green-500/10 text-green-400" },
    failed: { label: "Failed", color: "bg-red-500/10 text-red-400" },
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Brain Dump</h1>
      <p className="text-sm text-gray-500 mb-6">
        What did you ship today? The engine figures out what's worth broadcasting.
      </p>

      {configMissing && (
        <Link
          href="/onboard"
          className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300 hover:bg-yellow-500/10 transition-colors"
        >
          <span className="text-yellow-500 text-lg">&#9888;</span>
          <div>
            <span className="font-medium">Setup incomplete.</span>{" "}
            <span className="text-yellow-400/70">Complete onboarding so the engine knows your company type, goals, and channels.</span>
          </div>
        </Link>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setSuccess(false);
          }}
          rows={8}
          className="w-full rounded-xl border border-white/5 bg-[#0d0d12] px-4 py-3 font-mono text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors resize-y"
          placeholder="Shipped CloudCorrect v2 today. 65 AWS checks across 12 services. MIT licensed. Also client processed 400 docs through DocProof yesterday..."
        />

        <div className="mt-3 flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting || !rawText.trim()}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Brain Dump"}
          </button>

          {success && (
            <p className="text-sm text-green-400">
              Brain dump received. Processing...{" "}
              <Link href="/queue" className="text-cyan-400 hover:text-cyan-300 underline">
                View queue
              </Link>
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </form>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-300">Recent Dumps</h2>
          {total > 0 && (
            <span className="text-xs text-gray-600 font-mono">{total} total</span>
          )}
        </div>

        {loadingDumps ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : dumps.length === 0 ? (
          <p className="text-sm text-gray-600">No brain dumps yet. Write your first one above.</p>
        ) : (
          <>
            <div className="space-y-3">
              {dumps.map((dump) => {
                const isExpanded = expandedDumps.has(dump.id);
                const status = statusConfig[dump.processingStatus] || statusConfig.pending;
                const isLong = dump.rawText.length > 200;

                return (
                  <div key={dump.id} className="rounded-xl border border-white/5 bg-[#0d0d12] p-4">
                    <div
                      className={`cursor-pointer ${isLong && !isExpanded ? "relative" : ""}`}
                      onClick={() => isLong && toggleExpand(dump.id)}
                    >
                      <p className={`text-sm text-gray-300 whitespace-pre-wrap font-mono ${isLong && !isExpanded ? "line-clamp-3" : ""}`}>
                        {dump.rawText}
                      </p>
                      {isLong && !isExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0d0d12] to-transparent" />
                      )}
                    </div>

                    {isLong && (
                      <button onClick={() => toggleExpand(dump.id)} className="mt-1 text-xs text-cyan-500 hover:text-cyan-400">
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span>{new Date(dump.createdAt).toLocaleString()}</span>
                        <span className={`rounded-full px-2 py-0.5 ${status.color}`}>{status.label}</span>
                        {dump.emotionalState && dump.emotionalState !== "neutral" && (
                          <span className="rounded-full px-2 py-0.5 bg-purple-500/10 text-purple-400">{dump.emotionalState}</span>
                        )}
                      </div>

                      {(dump.processingStatus === "failed" || dump.processingStatus === "pending") && (
                        <button
                          onClick={() => handleReprocess(dump.id)}
                          disabled={reprocessing.has(dump.id)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          {reprocessing.has(dump.id) ? "Retrying..." : "Retry"}
                        </button>
                      )}
                    </div>

                    {dump.processingStatus === "failed" && dump.processingError && (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <p className="text-xs text-red-400 font-mono">{dump.processingError}</p>
                      </div>
                    )}
                  </div>
                );
              })}
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
                  Page {currentPage} of {totalPages}
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
    </div>
  );
}
