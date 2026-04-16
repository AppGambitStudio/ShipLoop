"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const companyTypes = [
  { value: "service_company", label: "Service Company", desc: "Consulting, agency, or dev shop. You sell expertise." },
  { value: "saas_founder", label: "SaaS / Product", desc: "You sell a product. Distribution feeds the funnel." },
  { value: "solo_creator", label: "Solo Creator", desc: "Educator, writer, or content creator. Presence is the product." },
  { value: "indie_builder", label: "Indie Builder", desc: "Building in public. The process IS the content." },
];

const platformOptions = [
  "linkedin", "twitter", "reddit", "hackernews", "indiehackers", "youtube", "newsletter", "devto", "github_readme",
];

const goalPlaceholders: Record<string, string> = {
  service_company: "Be known as the team that ships cloud + AI tools, with 3 inbound enquiries/month from CTOs...",
  saas_founder: "Get 50 trial signups/month from content, with 10% conversion to paid...",
  indie_builder: "Build a following of 1000 people who care about what I'm building, get 50 users from content...",
  solo_creator: "Grow to 1000 subscribers with 40% open rate and consistent weekly publishing...",
};

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyType, setCompanyType] = useState("");
  const [goalStatement, setGoalStatement] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("shiploop_token")) {
      router.replace("/login");
      return;
    }
    // Load existing config if any
    api.config.get()
      .then((config) => {
        if (config) {
          setCompanyType(config.companyType);
          setGoalStatement(config.goalStatement);
          setChannels((config.channels as string[]) || []);
          setIsEditing(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    if (!companyType || !goalStatement.trim() || channels.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await api.config.update({ companyType, goalStatement, channels });
      router.push("/dump");
    } catch (err: any) {
      setError(err.message || "Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        {isEditing ? "Settings" : "Set up ShipLoop"}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        {isEditing
          ? "Update your company type, goals, and distribution channels."
          : "Three quick questions so the engine knows how to help you."}
      </p>

      {/* Step 1: Company Type */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">What best describes you?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {companyTypes.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setCompanyType(ct.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  companyType === ct.value
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-white/5 bg-[#0d0d12] hover:border-white/20"
                }`}
              >
                <div className="text-sm font-medium text-white">{ct.label}</div>
                <div className="text-xs text-gray-500 mt-1">{ct.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => companyType && setStep(2)}
              disabled={!companyType}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Goal Statement */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-2">What does winning look like in 90 days?</h2>
          <p className="text-xs text-gray-500 mb-4">One paragraph. The Strategist uses this to keep your distribution on track.</p>
          <textarea
            value={goalStatement}
            onChange={(e) => setGoalStatement(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/5 bg-[#0d0d12] px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-cyan-500/50 transition-colors resize-y"
            placeholder={goalPlaceholders[companyType] || "Describe what success looks like..."}
          />
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-300">Back</button>
            <button
              onClick={() => goalStatement.trim() && setStep(3)}
              disabled={!goalStatement.trim()}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Channels */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-2">Where do you want to distribute?</h2>
          <p className="text-xs text-gray-500 mb-4">Pick the platforms you're active on. You can change this later.</p>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((ch) => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`rounded-lg border px-3 py-2 text-sm font-mono transition-colors ${
                  channels.includes(ch)
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                    : "border-white/5 bg-[#0d0d12] text-gray-500 hover:border-white/20 hover:text-gray-300"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-300">Back</button>
            <button
              onClick={handleSave}
              disabled={saving || channels.length === 0}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Start Using ShipLoop"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
