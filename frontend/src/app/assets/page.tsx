"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Asset {
  id: string;
  name: string;
  oneLiner: string;
  category: string;
  githubUrl: string | null;
  liveUrl: string | null;
  targetAudience: string;
  distributionStatus: string;
  priorityScore: number;
  createdAt: string;
}

const categories = [
  { value: "open_source", label: "Open Source" },
  { value: "product", label: "Product" },
  { value: "content", label: "Content" },
  { value: "talk", label: "Talk / Presentation" },
];

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [category, setCategory] = useState("product");
  const [targetAudience, setTargetAudience] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    loadAssets();
  }, [router]);

  const loadAssets = async () => {
    try {
      const data = await api.assets.list();
      setAssets(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setOneLiner("");
    setCategory("product");
    setTargetAudience("");
    setGithubUrl("");
    setLiveUrl("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !oneLiner.trim() || !targetAudience.trim()) return;

    setSaving(true);
    setError("");

    try {
      await api.assets.create({
        name: name.trim(),
        oneLiner: oneLiner.trim(),
        category,
        targetAudience: targetAudience.trim(),
        ...(githubUrl.trim() ? { githubUrl: githubUrl.trim() } : {}),
        ...(liveUrl.trim() ? { liveUrl: liveUrl.trim() } : {}),
      });
      resetForm();
      setShowForm(false);
      loadAssets();
    } catch (err: any) {
      setError(err.message || "Failed to create asset");
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    undistributed: "bg-gray-500/10 text-gray-400",
    in_progress: "bg-yellow-500/10 text-yellow-400",
    distributed: "bg-green-500/10 text-green-400",
    amplified: "bg-cyan-500/10 text-cyan-400",
  };

  const categoryColors: Record<string, string> = {
    open_source: "bg-green-600/20 text-green-400",
    product: "bg-blue-600/20 text-blue-400",
    content: "bg-purple-600/20 text-purple-400",
    talk: "bg-amber-600/20 text-amber-400",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your shipped work. The engine needs these to generate specific, credible content.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Asset"}
        </button>
      </div>

      {/* Add Asset Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-cyan-500/20 bg-[#0d0d12] p-5 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
              placeholder="CloudCorrect"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">One-liner *</label>
            <input
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
              placeholder="Open-source AWS audit tool with 65 checks across 12 services"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 outline-none"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Target Audience *</label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
                placeholder="DevOps engineers, CTOs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">GitHub URL</label>
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
                placeholder="https://github.com/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Live URL</label>
              <input
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 transition-colors"
                placeholder="https://..."
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || !name.trim() || !oneLiner.trim() || !targetAudience.trim()}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Add Asset"}
          </button>
        </form>
      )}

      {/* Asset List */}
      {loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-8 text-center">
          <p className="text-yellow-300 font-medium mb-2">No assets registered</p>
          <p className="text-sm text-yellow-400/70">
            The Strategist flagged this: without assets, all drafts are generic. Add your shipped projects, tools, and content so the engine can reference real work.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-white/5 bg-[#0d0d12] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{asset.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${categoryColors[asset.category] || "bg-gray-600/20 text-gray-400"}`}>
                    {asset.category.replace("_", " ")}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColors[asset.distributionStatus] || statusColors.undistributed}`}>
                  {asset.distributionStatus.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{asset.oneLiner}</p>
              <div className="flex items-center gap-3 text-[10px] text-gray-600">
                <span>Audience: {asset.targetAudience}</span>
                <span>Priority: {(asset.priorityScore * 100).toFixed(0)}%</span>
                {asset.githubUrl && <a href={asset.githubUrl} target="_blank" className="text-cyan-500 hover:text-cyan-400">GitHub</a>}
                {asset.liveUrl && <a href={asset.liveUrl} target="_blank" className="text-cyan-500 hover:text-cyan-400">Live</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
