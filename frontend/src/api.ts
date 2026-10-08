export type User = {
  id: string;
  githubUsername: string | null;
  githubName: string | null;
  email: string | null;
  avatarUrl: string | null;
};
async function request<T>(url: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "Request failed");
  return d as T;
}
export const api = {
  me: () => request<{ success: true; user: User }>("/api/auth/me"),
  login: () => {
    location.href = "/api/auth/github";
  },
  logout: () => request("/api/auth/logout", { method: "POST" }),
  projects: () => request<{ success: true; projects: any[] }>("/api/projects"),
  project: (id: string) =>
    request<{ success: true; project: any }>(`/api/projects/${id}`),
  createProject: (x: any) =>
    request<{ success: true; project: any }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(x),
    }),
  generate: (id: string, prompt: string) =>
    request<any>(`/api/projects/${id}/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  history: (id: string) => request<any>(`/api/projects/${id}/history`),
  agent: () => request<any>("/api/agent"),
  providers: () => request<any>("/api/ai/providers"),
};
