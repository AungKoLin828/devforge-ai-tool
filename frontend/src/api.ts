// API response types shared by the dashboard and Local Agent controls.
export type User = {
  id: string;
  githubUsername: string | null;
  githubName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/** One turn in the short project-question conversation sent to the API. */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Basic health details returned when the browser pairs with a local agent. */
export type LocalAgentInfo = {
  machine: string;
  platform: string;
  workspaceRoot: string;
};

/** Captured result of a command run by the Local Agent. */
export type LocalCommandResult = {
  name: string;
  command: string;
  code: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

/** Result of the project's build or test stages on the local machine. */
export type LocalProjectResult = {
  action: "build" | "test";
  stages: LocalCommandResult[];
  success: boolean;
};

/** UTF-8 project file exchanged with the Local Agent. */
export type LocalProjectFile = {
  path: string;
  content: string;
};

/** GitHub repository available for linking from the project workspace. */
export type GitHubRepository = {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

/** Repository identity and default branch currently linked to a project. */
export type ConnectedGitHubRepository = {
  owner: string;
  repository: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
};

/** Summary of a local clone, pull, initialization, or push operation. */
export type LocalGitResult = {
  success: true;
  path: string;
  branch: string;
  output: string;
  commit?: string;
};

/** Sanitized local project snapshot returned for import into DevForge. */
export type LocalProjectImport = {
  name: string;
  path: string;
  files: LocalProjectFile[];
};

/** A visible file or folder entry returned by the Local Agent browser. */
export type LocalWorkspaceEntry = {
  name: string;
  path: string;
  type: "directory" | "file";
  size?: number;
  editable?: boolean;
};

/** Directory listing with a relative parent path for workspace navigation. */
export type LocalWorkspaceListing = {
  path: string;
  parent: string | null;
  entries: LocalWorkspaceEntry[];
};

/** Editable text file plus its on-disk timestamp used for safe saves. */
export type LocalWorkspaceFile = {
  path: string;
  content: string;
  modifiedAt: number;
};

// The agent binds to loopback so the browser can reach only this machine's service.
const LOCAL_AGENT_URL = "http://127.0.0.1:45821";

let activeApiRequests = 0;
const apiActivitySubscribers = new Set<() => void>();

/** Subscribe to the number of API and Local Agent requests currently in flight. */
export function subscribeToApiActivity(subscriber: () => void) {
  apiActivitySubscribers.add(subscriber);
  return () => apiActivitySubscribers.delete(subscriber);
}

/** Read the stable request count used by React's external-store subscription. */
export function getApiActivitySnapshot() {
  return activeApiRequests;
}

/** Mark a request active and return an idempotent callback to finish its activity. */
export function beginApiActivity() {
  activeApiRequests += 1;
  apiActivitySubscribers.forEach((subscriber) => subscriber());

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeApiRequests = Math.max(0, activeApiRequests - 1);
    apiActivitySubscribers.forEach((subscriber) => subscriber());
  };
}

// Attach the pairing token, enforce a request deadline, and preserve agent errors.
async function localAgentRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 10 * 60 * 1000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const finishActivity = beginApiActivity();

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
      if (response.status === 404) {
        throw new Error(
          `The Local Agent does not recognize ${path}. Stop the running agent, update/reinstall it, and start it again before retrying.`,
        );
      }
      throw new Error(body.error || `Local agent request failed (${response.status})`);
    }
    return body as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new Error(
        "The Local Agent request timed out. Check the agent terminal and retry when it is ready.",
      );
    }
    if (cause instanceof TypeError) {
      throw new Error(
        "Could not reach the local agent. Start it on your PC and check its pairing token.",
      );
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
    finishActivity();
  }
}

// Send same-origin API requests with the signed-in session cookie.
async function request<T>(url: string, init: RequestInit = {}) {
  const finishActivity = beginApiActivity();
  try {
    const r = await fetch(url, {
      credentials: "include",
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || "Request failed");
    return d as T;
  } finally {
    finishActivity();
  }
}

// Browser-facing API surface grouped with the local-agent operations below.
export const api = {
  // Session and GitHub OAuth-backed repository operations.
  me: () => request<{ success: true; user: User }>("/api/auth/me"),
  login: () => {
    location.href = "/api/auth/github";
  },
  logout: () => request("/api/auth/logout", { method: "POST" }),
  githubRepositories: () =>
    request<{ success: true; repositories: GitHubRepository[] }>(
      "/api/github/repositories",
    ),
  connectGitHubRepository: (projectId: string, owner: string, repository: string) =>
    request<{ success: true; repository: ConnectedGitHubRepository }>(
      `/api/projects/${encodeURIComponent(projectId)}/github/connect`,
      {
        method: "POST",
        body: JSON.stringify({ owner, repository }),
      },
    ),
  createGitHubRepository: (
    projectId: string,
    name: string,
    description: string,
    isPrivate: boolean,
  ) =>
    request<{ success: true; repository: ConnectedGitHubRepository }>(
      `/api/projects/${encodeURIComponent(projectId)}/github/create`,
      {
        method: "POST",
        body: JSON.stringify({ name, description, private: isPrivate }),
      },
    ),
  updateGitHubSync: (
    projectId: string,
    path: string,
    status: "CONNECTED" | "CLEAN" | "ERROR",
  ) =>
    request<{ success: true; localPath: string; gitSyncStatus: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/github/status`,
      {
        method: "POST",
        body: JSON.stringify({ path, status }),
      },
    ),
  // Detach a GitHub remote from the DevForge project without deleting it.
  disconnectGitHubRepository: (projectId: string) =>
    request<{ success: true }>(
      `/api/projects/${encodeURIComponent(projectId)}/github/disconnect`,
      { method: "POST" },
    ),
  // Project records and long-running AI operations.
  projects: () => request<{ success: true; projects: any[] }>("/api/projects"),
  project: (id: string) =>
    request<{ success: true; project: any }>(`/api/projects/${id}`),
  deleteProject: (id: string) =>
    request<{ success: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  removeImportedProject: (id: string) =>
    request<{ success: true }>(
      `/api/projects/${encodeURIComponent(id)}/import/remove`,
      { method: "POST" },
    ),
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
  chat: (id: string, messages: ChatMessage[]) =>
    request<{ success: true; answer: string }>(`/api/projects/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
  history: (id: string) => request<any>(`/api/projects/${id}/history`),
  agent: () => request<any>("/api/agent"),
  providers: () => request<any>("/api/ai/providers"),
  // Local Agent requests are authenticated directly with its browser-held pairing token.
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
    workspaceFiles: (token: string, path: string) =>
      localAgentRequest<{ success: true } & LocalWorkspaceListing>(
        token,
        `/workspace/files?path=${encodeURIComponent(path)}`,
        {},
        15000,
      ),
    readWorkspaceFile: (token: string, path: string) =>
      localAgentRequest<{ success: true; file: LocalWorkspaceFile }>(
        token,
        `/workspace/file?path=${encodeURIComponent(path)}`,
        {},
        15000,
      ),
    writeWorkspaceFile: (
      token: string,
      file: LocalWorkspaceFile,
      content: string,
    ) =>
      localAgentRequest<{
        success: true;
        file: Pick<LocalWorkspaceFile, "path" | "modifiedAt">;
      }>(token, "/workspace/file", {
        method: "POST",
        body: JSON.stringify({
          path: file.path,
          content,
          expectedModifiedAt: file.modifiedAt,
        }),
      }),
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
    cloneGitHubRepository: (
      token: string,
      input: { owner: string; repository: string; branch: string; path: string },
    ) =>
      localAgentRequest<LocalGitResult>(
        token,
        "/git/clone",
        { method: "POST", body: JSON.stringify(input) },
        25 * 60 * 1000,
      ),
    initializeGitHubRepository: (
      token: string,
      input: { owner: string; repository: string; branch: string; path: string },
    ) =>
      localAgentRequest<LocalGitResult>(
        token,
        "/git/init",
        { method: "POST", body: JSON.stringify(input) },
        25 * 60 * 1000,
      ),
    pullGitHubRepository: (
      token: string,
      input: { owner: string; repository: string; branch: string; path: string },
    ) =>
      localAgentRequest<LocalGitResult>(
        token,
        "/git/pull",
        { method: "POST", body: JSON.stringify(input) },
        25 * 60 * 1000,
      ),
    pushGitHubRepository: (
      token: string,
      input: {
        owner: string;
        repository: string;
        branch: string;
        path: string;
        message: string;
      },
    ) =>
      localAgentRequest<LocalGitResult>(
        token,
        "/git/push",
        { method: "POST", body: JSON.stringify(input) },
        25 * 60 * 1000,
      ),
    runProject: (token: string, action: "build" | "test", path: string) =>
      localAgentRequest<{ success: true; result: LocalProjectResult }>(
        token,
        `/project/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ path }),
        },
        25 * 60 * 1000,
      ),
  },
};
