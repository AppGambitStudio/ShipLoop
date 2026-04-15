"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Dump {
  id: string;
  rawText: string;
  status: string;
  createdAt: string;
}

export default function DumpPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dumps, setDumps] = useState<Dump[]>([]);
  const [loadingDumps, setLoadingDumps] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadDumps();
  }, [router]);

  const loadDumps = async () => {
    try {
      const data = await api.dumps.list();
      setDumps(data);
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
      loadDumps();
    } catch (err: any) {
      setError(err.message || "Failed to submit brain dump");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Brain Dump</h1>
      <p className="text-sm text-gray-500 mb-6">
        Dump your thoughts. We turn them into distribution-ready content.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setSuccess(false);
          }}
          rows={8}
          className="w-full rounded-xl border border-white/5 bg-[#0d0d12] px-4 py-3 font-mono text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors resize-y"
          placeholder="What did you ship today? Stream of consciousness. No formatting needed."
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
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Recent Dumps</h2>

        {loadingDumps ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : dumps.length === 0 ? (
          <p className="text-sm text-gray-600">No brain dumps yet. Write your first one above.</p>
        ) : (
          <div className="space-y-3">
            {dumps.map((dump) => (
              <div
                key={dump.id}
                className="rounded-xl border border-white/5 bg-[#0d0d12] p-4"
              >
                <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-4 font-mono">
                  {dump.rawText}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                  <span>{new Date(dump.createdAt).toLocaleString()}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      dump.status === "processed"
                        ? "bg-green-500/10 text-green-400"
                        : dump.status === "processing"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {dump.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
