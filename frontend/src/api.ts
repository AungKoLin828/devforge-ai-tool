export type User = {
  id: string;
  githubUsername: string | null;
  githubName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type LocalAgentInfo = {
  machine: string;
  platform: string;
  workspaceRoot: string;
};

export type LocalCommandResult = {
  name: string;
  command: string;
  code: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

export type LocalProjectResult = {
  action: "build" | "test";
  stages: LocalCommandResult[];
  success: boolean;
};

export type LocalProjectFile = {
  path: string;
  content: string;
};

export type LocalProjectImport = {
  name: string;
  path: string;
  files: LocalProjectFile[];
};

const LOCAL_AGENT_URL = "http://127.0.0.1:45821";

async function localAgentRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 10 * 60 * 1000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${LOCAL_AGENT_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Local agent request failed (${response.status})`);
    }
    return body as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new Error("Local agent request timed out.");
    }
    if (cause instanceof TypeError) {
      throw new Error(
        "Could not reach the local agent. Start it on your PC and check its pairing token.",
      );
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

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
  deleteProject: (id: string) =>
    request<{ success: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  importProject: (project: LocalProjectImport, name: string) =>
    request<{ success: true; project: any }>("/api/projects/import", {
      method: "POST",
      body: JSON.stringify({
        name,
        sourcePath: project.path,
        files: project.files,
      }),
    }),
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
  localAgent: {
    health: (token: string) =>
      localAgentRequest<{ ok: true } & LocalAgentInfo>(
        token,
        "/health",
        {},
        8000,
      ),
    workspaceProjects: (token: string) =>
      localAgentRequest<{
        success: true;
        projects: Array<{ name: string; path: string }>;
      }>(token, "/workspace/projects", {}, 15000),
    importProject: (token: string, path: string) =>
      localAgentRequest<{ success: true; project: LocalProjectImport }>(
        token,
        "/workspace/import",
        { method: "POST", body: JSON.stringify({ path }) },
        60000,
      ),
    syncProject: (token: string, path: string, files: unknown[]) =>
      localAgentRequest<{ success: true; path: string; files: number }>(
        token,
        "/project/sync",
        {
          method: "POST",
          body: JSON.stringify({ path, files }),
        },
      ),
    runProject: (token: string, action: "build" | "test", path: string) =>
      localAgentRequest<{ success: true; result: LocalProjectResult }>(
        token,
        `/project/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ path }),
        },
      ),
  },
};
