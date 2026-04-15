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
    list: () => fetchAPI<any[]>("/api/dumps"),
  },
  drafts: {
    pending: () => fetchAPI<any[]>("/api/drafts/pending"),
    approve: (id: string) =>
      fetchAPI<any>(`/api/drafts/${id}/approve`, { method: "POST" }),
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
};
