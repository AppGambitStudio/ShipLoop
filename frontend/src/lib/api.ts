const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("shiploop_token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }

  return res.json();
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      fetchAPI<{ token: string; user: { id: string; email: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      fetchAPI<{ token: string; user: { id: string; email: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },
  config: {
    get: () => fetchAPI<any>("/api/config"),
    update: (data: { companyType: string; goalStatement: string; channels: string[] }) =>
      fetchAPI<any>("/api/config", { method: "PUT", body: JSON.stringify(data) }),
  },
  assets: {
    list: () => fetchAPI<any[]>("/api/assets"),
    create: (data: any) =>
      fetchAPI<any>("/api/assets", { method: "POST", body: JSON.stringify(data) }),
  },
  dumps: {
    submit: (rawText: string) =>
      fetchAPI<{ id: string; status: string }>("/api/dumps", {
        method: "POST",
        body: JSON.stringify({ rawText }),
      }),
    list: (limit = 10, offset = 0) =>
      fetchAPI<{ dumps: any[]; total: number; limit: number; offset: number }>(
        `/api/dumps?limit=${limit}&offset=${offset}`
      ),
    reprocess: (id: string) =>
      fetchAPI<{ id: string; status: string }>(`/api/dumps/${id}/reprocess`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },
  drafts: {
    pending: (limit = 10, offset = 0) =>
      fetchAPI<{ drafts: any[]; total: number; limit: number; offset: number }>(
        `/api/drafts/pending?limit=${limit}&offset=${offset}`
      ),
    stats: () =>
      fetchAPI<{ total: number; pending: number; approved: number; edited: number; skipped: number; expired: number }>(
        "/api/drafts/stats"
      ),
    approve: (id: string) =>
      fetchAPI<any>(`/api/drafts/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
    edit: (id: string, editedContent: string) =>
      fetchAPI<any>(`/api/drafts/${id}/edit`, {
        method: "POST",
        body: JSON.stringify({ editedContent }),
      }),
    skip: (id: string, reason: string, reasonText?: string) =>
      fetchAPI<any>(`/api/drafts/${id}/skip`, {
        method: "POST",
        body: JSON.stringify({ reason, reasonText }),
      }),
  },
  posted: {
    report: (draftId: string, postUrl: string) =>
      fetchAPI<any>("/api/posted", {
        method: "POST",
        body: JSON.stringify({ draftId, postUrl }),
      }),
    list: () => fetchAPI<any[]>("/api/posted"),
  },
  voiceProfile: {
    stats: () => fetchAPI<any>("/api/voice-profile/stats"),
    recent: (limit = 20) => fetchAPI<any[]>(`/api/voice-profile/recent?limit=${limit}`),
  },
  strategist: {
    run: (type: "weekly" | "quarterly" = "weekly") =>
      fetchAPI<{ status: string; type: string }>("/api/strategist/run", {
        method: "POST",
        body: JSON.stringify({ type }),
      }),
    latest: () => fetchAPI<any>("/api/strategist/latest"),
    history: (limit = 10) => fetchAPI<any[]>(`/api/strategist/history?limit=${limit}`),
  },
};
