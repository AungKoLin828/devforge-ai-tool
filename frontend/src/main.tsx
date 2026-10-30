import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { strToU8, zipSync } from "fflate";
import {
  api,
  getApiActivitySnapshot,
  subscribeToApiActivity,
  type AdminStats,
  type AdminUser,
  type ChatMessage,
  type AIProvider,
  type AIProviderInfo,
  type LocalProjectResult,
  type LocalWorkspaceEntry,
  type LocalWorkspaceFile,
  type LocalWorkspaceListing,
  type LocalProjectStreamEvent,
  type GitHubRepository,
  type User,
} from "./api";
import { useProjectGeneration } from "./hooks/useProjectGeneration";

type EditorDiagnostic = {
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
  severity: "error" | "warning";
};

const DIAGNOSTIC_SOURCE_EXTENSIONS =
  "(?:tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|java|c|cc|cpp|h|hpp|css|json|html)";

function normalizeDiagnosticPath(value: string) {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .toLowerCase();
}

function parseBuildDiagnostics(result: LocalProjectResult | null) {
  if (!result) return [];
  const diagnostics: EditorDiagnostic[] = [];
  const seen = new Set<string>();
  const patterns = [
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS})\\((\\d+),(\\d+)\\):\\s*(error|warning)(?:\\s+TS\\d+)?:\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS}):(\\d+):(\\d+):\\s*(error|warning):\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS}):(\\d+):\\s*(error|warning):\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS})\\s+(\\d+):(\\d+)\\s+(error|warning)\\s+(.+)$`,
      "i",
    ),
  ];

  for (const stage of result.stages) {
    if (stage.code === 0) continue;
    const output = `${stage.stdout}\n${stage.stderr}`.replace(
      /\u001b\[[0-9;]*m/g,
      "",
    );
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      let diagnostic: EditorDiagnostic | null = null;
      const unresolvedImport = line.match(
        /Could not resolve import ["']([^"']+)["'] from ["']([^"']+)["']/i,
      );
      if (unresolvedImport) {
        diagnostic = {
          file: unresolvedImport[2],
          line: null,
          column: null,
          message: `Cannot resolve import "${unresolvedImport[1]}".`,
          severity: "error",
        };
      } else {
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (!match) continue;
          const hasColumn = pattern !== patterns[2];
          const severityGroup = hasColumn ? 4 : 3;
          diagnostic = {
            file: match[1],
            line: Number(match[2]),
            column: hasColumn ? Number(match[3]) : null,
            severity: match[severityGroup].toLowerCase() as "error" | "warning",
            message: match[severityGroup + 1],
          };
          break;
        }
      }
      if (
        !diagnostic &&
        /\b(error|failed to compile|build failed)\b/i.test(line)
      ) {
        diagnostic = {
          file: null,
          line: null,
          column: null,
          severity: "error",
          message: line.slice(0, 500),
        };
      }
      if (!diagnostic) continue;
      const key = `${diagnostic.file ?? ""}:${diagnostic.line ?? ""}:${diagnostic.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics.slice(0, 100);
}

// Shared logo asset used by the landing page, guide, and dashboard headers.
function BrandWordmark() {
  return (
    <span className="brand-logo">
      <img src="/DevForgeAI.png" alt="DevForge AI" />
    </span>
  );
}

// Public instructions remain available even when no user session exists.
function UserGuide() {
  const steps = [
    {
      number: "01",
      title: "Sign in and create a project",
      description:
        "Reading this guide is public. To save project data or use workspace features, sign in with GitHub, then select New Project and describe what you want to build.",
    },
    {
      number: "02",
      title: "Generate and review the project",
      description:
        "Choose Generate to create the project plan and code. When you want to change saved code, use Request modification and describe the changes. Project chat answers questions but does not edit files. AI code review checks saved code and stores its findings.",
    },
    {
      number: "03",
      title: "Open and edit the project in VS Code",
      description:
        "For a simple download, choose Download ZIP in the project workspace; no Local Agent is needed. Extract the downloaded archive and open the project folder in VS Code. To sync directly into the DevForge workspace, or use local build/test and GitHub operations, install the Local Agent once, then select Start and connect agent. DevForge does not currently provide a dedicated VS Code extension.",
    },
    {
      number: "04",
      title: "Build and test safely",
      description:
        "Build locally and Test locally ask before running scripts and stream output to the local terminal panel. Use Build edited files after changing a synced project in the Code Editor to keep those edits; the standard Build locally and Test locally actions sync saved generated files first and can overwrite local edits.",
    },
    {
      number: "05",
      title: "Synchronize with GitHub",
      description:
        "From a project, connect an existing repository or create a new public or private repository. Use the Local Agent for clone, pull, and push operations. Git must be installed and authenticated on the PC running the agent.",
    },
    {
      number: "06",
      title: "Choose the right removal action",
      description:
        "Remove imported project removes its DevForge copy without deleting local PC files. Delete project permanently removes the DevForge project and its saved artifacts. Disconnect repository removes the GitHub link without deleting the remote repository.",
    },
  ];

  return (
    <main className="landing min-h-screen">
      <header className="landing-nav mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a
          href="/"
          className="inline-flex items-center"
          aria-label="DevForge AI home"
        >
          <BrandWordmark />
        </a>
        <a
          href="/"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400 hover:text-white"
        >
          Back to home
        </a>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Public user guide
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Get started with DevForge AI
        </h1>
        <p className="mt-5 max-w-3xl leading-7 text-slate-300">
          GitHub sign-in is required only when you use the app to create or
          manage projects, generate code, or access connected services.
        </p>

        <ol className="mt-10 space-y-4">
          {steps.map((step) => (
            <li key={step.number} className="glass rounded-2xl p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 font-mono text-sm font-semibold text-indigo-300">
                  {step.number}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {step.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-semibold text-white">Keeping your work safe</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Keep credentials and secret files private. The Local Agent is a
            separate program on your PC; review confirmations before running
            project scripts. Disconnecting a repository does not revoke access
            from GitHub or delete its remote contents.
          </p>
        </div>

        <a
          href="/"
          className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500"
        >
          Go to DevForge AI
        </a>
      </section>
    </main>
  );
}

// Landing screen and GitHub sign-in entry point for unauthenticated visitors.
function Login() {
  const [signingIn, setSigningIn] = useState(false);
  function startGitHubLogin() {
    if (signingIn) return;
    setSigningIn(true);
    api.login();
  }

  const capabilities = [
    // Keep feature cards declarative so the landing-page copy stays in one place.
    {
      number: "01",
      title: "Plan the project",
      description:
        "Turn a product brief into requirements, architecture, database design, API design, and an implementation plan.",
    },
    {
      number: "02",
      title: "Generate and keep the work",
      description:
        "Generate code with OpenRouter, OpenAI, or your own OpenAI-compatible provider and save the plans and files.",
    },
    {
      number: "03",
      title: "Develop locally",
      description:
        "Connect a workspace-restricted local agent to import projects and run build or test commands on your PC.",
    },
    {
      number: "04",
      title: "Works in VS Code",
      description:
        "Install the DevForge AI VS Code extension to chat with the assistant, review code, fix errors, and generate tests without leaving the editor. Sign in once with device pairing and everything runs from the DevForge chat panel (Ctrl+Alt+D).",
    },
  ];

  const roadmap = [
    // Display shipped and planned workflow areas in their numbered roadmap order.
    ["01", "Generation you can verify", "Available"],
    ["02", "AI code review", "Available"],
    ["03", "Local project import, build and test", "Available"],
    ["04", "GitHub synchronization", "Available"],
    ["05", "More AI providers", "Available"],
  ];

  return (
    <main className="landing min-h-screen overflow-hidden">
      <header className="landing-nav mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a
          href="/"
          className="inline-flex items-center"
          aria-label="DevForge AI home"
        >
          <BrandWordmark />
        </a>
        <nav className="flex items-center gap-3" aria-label="Public navigation">
          <a
            href="/guide"
            className="px-2 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            User guide
          </a>
          <button
            onClick={startGitHubLogin}
            disabled={signingIn}
            aria-busy={signingIn}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-wait disabled:opacity-75"
          >
            {signingIn && (
              <span className="api-loading-spinner" aria-hidden="true" />
            )}
            {signingIn ? "Connecting to GitHub..." : "Sign in with GitHub"}
          </button>
        </nav>
      </header>

      <section className="landing-hero mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            FROM IDEA TO REVIEWABLE PROJECT
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Build with AI.
            <span className="landing-gradient block">
              Keep control of the code.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            DevForge turns your project brief into a structured plan and
            generated code, keeps the artifacts in PostgreSQL, and is designed
            to bring your local development workflow into the loop.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={startGitHubLogin}
              disabled={signingIn}
              aria-busy={signingIn}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-75"
            >
              {signingIn ? (
                <>
                  <span className="api-loading-spinner" aria-hidden="true" />
                  Connecting to GitHub...
                </>
              ) : (
                <>
                  Continue with GitHub <span aria-hidden="true">→</span>
                </>
              )}
            </button>
            <a
              href="#how-it-works"
              className="rounded-xl border border-slate-700 px-6 py-3.5 text-center font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Explore the workflow
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            GitHub is used to sign in and optionally sync repositories. Your AI
            provider key stays on the server.
          </p>
        </div>

        <div
          className="glass landing-preview rounded-2xl p-5 shadow-2xl shadow-indigo-950/20 sm:p-6"
          aria-label="Example generated project workflow"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <p className="text-xs text-slate-500">PROJECT WORKSPACE</p>
              <p className="mt-1 font-semibold text-slate-100">taskboard-app</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
              READY
            </span>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ["✓", "Requirements", "Saved"],
              ["✓", "Architecture", "Saved"],
              ["✓", "Database & API design", "Saved"],
              ["✓", "Implementation plan", "Saved"],
              ["✓", "Generated code", "Saved"],
            ].map(([icon, title, status]) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5"
              >
                <span className="text-emerald-400" aria-hidden="true">
                  {icon}
                </span>
                <span className="flex-1 text-sm text-slate-200">{title}</span>
                <span className="text-xs text-slate-500">{status}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs leading-6 text-slate-400">
            <div>
              <span className="text-indigo-300">src/</span>{" "}
              components/TaskBoard.tsx
            </div>
            <div>
              <span className="text-indigo-300">src/</span> api/tasks.ts
            </div>
            <div>
              <span className="text-indigo-300">prisma/</span> schema.prisma
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            Example workflow preview
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-20 pt-8"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            A transparent workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
            One workspace, from brief to build.
          </h2>
          <p className="mt-3 leading-7 text-slate-400">
            See what DevForge does today and what is being connected next.
          </p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item) => (
            <article key={item.number} className="glass rounded-2xl p-6">
              <span className="text-sm font-semibold text-indigo-300">
                {item.number}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        {/* VS Code extension availability notice. */}
        <div
          className="glass mt-9 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center"
          aria-label="VS Code extension availability"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Also available for VS Code
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              DevForge AI Developer Tools extension
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Everything runs from chat right inside your editor: generate
              source, review code, analyze errors, create tests, and send build
              requests. Sign in with secure device pairing — no API key or
              cookie copying needed.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 text-sm">
            <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">
              Extensions panel → search “DevForge AI”
            </span>
            <span className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">
              Install the .vsix from the guide
            </span>
            <span className="text-xs text-slate-500">
              Open chat with Ctrl+Alt+D inside VS Code
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Product roadmap
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Built in practical steps.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The roadmap is explicit so you can distinguish working features
              from what is still being developed.
            </p>
          </div>
          <ol className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/40 px-5">
            {roadmap.map(([number, title, status]) => (
              <li key={number} className="flex items-center gap-4 py-4">
                <span className="font-mono text-xs text-slate-500">
                  {number}
                </span>
                <span className="flex-1 text-sm text-slate-200">{title}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${status === "Available" ? "bg-emerald-400/10 text-emerald-300" : status === "In progress" ? "bg-amber-400/10 text-amber-300" : "bg-slate-800 text-slate-400"}`}
                >
                  {status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            DevForge AI · Your projects stay yours.{" "}
            <a
              href="/guide"
              className="ml-2 text-indigo-300 hover:text-indigo-200"
            >
              User guide
            </a>
          </span>
          <span>
            © {new Date().getFullYear()} Aung Ko Lin. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}

// Authenticated project workspace, Local Agent controls, and GitHub tools.
/**
 * Detect which DevForge workflow a chat message asks for. All processes run
 * from chat, so plain wording like "generate a todo app" or "review my code"
 * maps onto the matching backend operation.
 */
function detectChatIntent(
  text: string,
):
  | "generate"
  | "modify"
  | "review"
  | "build"
  | "test"
  | "save"
  | "connect-agent"
  | "disconnect-agent"
  | "chat" {
  const value = text.toLowerCase();
  if (
    /(disconnect|unpair|stop using).*(agent|local)|\bdisconnect agent\b/.test(
      value,
    )
  )
    return "disconnect-agent";
  if (
    /(connect|start|pair|launch|run).*(agent|local)/.test(value) ||
    /\b(connect|start) agent\b/.test(value)
  )
    return "connect-agent";
  if (
    /\b(save|export|download|sync)\b/.test(value) &&
    /\b(file|folder|pc|computer|local|disk|drive)\b/.test(value)
  )
    return "save";
  if (/\b(build|compile)\b/.test(value)) return "build";
  if (/\b(test|run tests)\b/.test(value)) return "test";
  if (/\b(review|audit|find issues|find bugs)\b/.test(value)) return "review";
  if (/(modify|change|update|refactor|add|fix|improve|edit)\b/.test(value))
    return "modify";
  if (/(generate|create|build me|make|scaffold|new project)\b/.test(value))
    return "generate";
  return "chat";
}

/** Remove intent keywords so the rest of the sentence can seed a prompt. */
function stripIntentKeywords(text: string): string {
  return text
    .replace(
      /^(please\s+)?(devforge[,:]\s*)?(can you\s+)?(now\s+)?(generate|create|modify|update|change|refactor|improve|review|audit)\b/i,
      "",
    )
    .replace(/\b(the\s+)?(project|source code|code|files)\b\s*$/i, "")
    .trim();
}

/**
 * Write generated files straight to a PC folder using the browser's
 * File System Access API — no Local Agent required. Returns false when the
 * browser does not support the API or the user cancels the folder picker.
 */
async function saveGeneratedFilesToLocalPcGeneric(
  files: Array<{ path: string; content: string }>,
  projectName: string,
): Promise<boolean> {
  type DirHandle = {
    getDirectoryHandle: (
      name: string,
      options?: { create?: boolean },
    ) => Promise<DirHandle>;
    getFileHandle: (
      name: string,
      options?: { create?: boolean },
    ) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (options?: {
        mode?: string;
        startIn?: string;
      }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker;
  if (typeof picker !== "function") return false;
  let root: DirHandle;
  try {
    root = await picker({ mode: "readwrite" });
  } catch {
    return false; // user cancelled the folder picker
  }
  for (const file of files) {
    const segments = file.path.replaceAll("\\", "/").split("/");
    if (
      !file.path ||
      file.path.startsWith("/") ||
      /^[a-zA-Z]:/.test(file.path) ||
      segments.some(
        (segment) => !segment || segment === "." || segment === "..",
      )
    )
      continue;
    let dir = root;
    for (const segment of segments.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const handle = await dir.getFileHandle(segments.at(-1)!, {
      create: true,
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([file.content], { type: "text/plain" }));
    await writable.close();
  }
  return files.length > 0;
}

/** Write all generated files of the selected project into a PC folder. */
async function saveGeneratedFilesToLocalPcCandidate(
  files: Array<{ path: string; content: string }>,
  projectName: string,
): Promise<boolean> {
  return saveGeneratedFilesToLocalPcGeneric(files, projectName);
}

/** True for transient AI/API failures that are safe to retry automatically. */
function isRetryableAiRequestError(cause: unknown): boolean {
  if (cause instanceof TypeError) return true; // fetch network failure
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (!message) return false;
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    /http 429/.test(message) ||
    /http 5\d\d/.test(message) ||
    /\b(429|500|502|503|504)\b/.test(message) ||
    message.includes("rate limit") ||
    message.includes("overloaded")
  );
}

function App({ user }: { user: User }) {
  // Message dialogs and confirmations share one resolver so every action is modal-based.
  type ModalKind = "info" | "success" | "warning" | "error";
  // Optional labels distinguish a confirmation dialog from a dismiss-only message.
  type ModalState = {
    kind: ModalKind;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  };

  // Dashboard selection and transient state for independent workflow panels.
  const [projects, setProjects] = useState<any[]>([]);
  const activeApiRequests = useSyncExternalStore(
    subscribeToApiActivity,
    getApiActivitySnapshot,
    () => 0,
  );
  const hasApiActivity = activeApiRequests > 0;
  const [showApiLoading, setShowApiLoading] = useState(false);
  useEffect(() => {
    if (!hasApiActivity) {
      setShowApiLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => setShowApiLoading(true), 250);
    return () => window.clearTimeout(timeout);
  }, [hasApiActivity]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const modalResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [selected, setSelected] = useState<any>();
  const [selectedAIProvider, setSelectedAIProvider] = useState<AIProvider>(
    () => {
      const saved = window.localStorage.getItem("devforge-ai-provider");
      return saved === "OPENAI" || saved === "CUSTOM" ? saved : "OPENROUTER";
    },
  );
  const [aiProviderConfigs, setAIProviderConfigs] = useState<AIProviderInfo[]>(
    [],
  );
  const [providerSettingsExpanded, setProviderSettingsExpanded] =
    useState(false);
  const [providerSettingsProvider, setProviderSettingsProvider] =
    useState<AIProvider>("OPENROUTER");
  const [providerApiKeyDraft, setProviderApiKeyDraft] = useState("");
  const [providerModelDraft, setProviderModelDraft] = useState("");
  const [providerBaseUrlDraft, setProviderBaseUrlDraft] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  // Keep the last failed chat question so the Retry button can replay it.
  const [lastFailedChatQuestion, setLastFailedChatQuestion] = useState<
    string | null
  >(null);
  // Keep the pairing secret in this browser only; it is sent directly to loopback.
  const [localAgentToken, setLocalAgentToken] = useState(
    () => window.localStorage.getItem("devforge-local-agent-token") || "",
  );
  const [localAgentConnecting, setLocalAgentConnecting] = useState(false);
  const [localAgentInfo, setLocalAgentInfo] = useState<{
    machine: string;
    platform: string;
    workspaceRoot: string;
  } | null>(null);
  const [localAgentError, setLocalAgentError] = useState<string | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<
    Array<{ name: string; path: string }>
  >([]);
  const [localImportPath, setLocalImportPath] = useState("");
  const [importingProject, setImportingProject] = useState(false);
  const [workspaceListing, setWorkspaceListing] =
    useState<LocalWorkspaceListing | null>(null);
  const [workspaceEntriesLoading, setWorkspaceEntriesLoading] = useState(false);
  const [workspaceBrowserError, setWorkspaceBrowserError] = useState<
    string | null
  >(null);
  const [workspaceEditorFile, setWorkspaceEditorFile] =
    useState<LocalWorkspaceFile | null>(null);
  const [workspaceEditorDraft, setWorkspaceEditorDraft] = useState("");
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [generatedExplorerExpanded, setGeneratedExplorerExpanded] =
    useState(true);
  const [generatedExplorerHeight, setGeneratedExplorerHeight] = useState<
    "min" | "max"
  >("min");
  const [editorJump, setEditorJump] = useState<{
    line: number;
    column: number | null;
  } | null>(null);
  const [editorCursor, setEditorCursor] = useState({ line: 1, column: 1 });
  const workspaceEditorRef = useRef<HTMLTextAreaElement>(null);
  const editorGutterRef = useRef<HTMLDivElement>(null);
  const [syncingGeneratedFiles, setSyncingGeneratedFiles] = useState(false);
  const [downloadingProjectZip, setDownloadingProjectZip] = useState(false);
  // GitHub selection, workspace path, and mutually exclusive repository operations.
  const [githubRepositories, setGitHubRepositories] = useState<
    GitHubRepository[]
  >([]);
  const [githubRepositorySelection, setGitHubRepositorySelection] =
    useState("");
  const [githubNewRepository, setGitHubNewRepository] = useState("");
  const [githubNewRepositoryPrivate, setGitHubNewRepositoryPrivate] =
    useState(true);
  const [githubLocalPath, setGitHubLocalPath] = useState("");
  const [githubCommitMessage, setGitHubCommitMessage] = useState("");
  const [githubBusy, setGitHubBusy] = useState<
    | "repositories"
    | "connect"
    | "create"
    | "clone"
    | "pull"
    | "push"
    | "disconnect"
    | null
  >(null);
  const [githubError, setGitHubError] = useState<string | null>(null);
  // Local action state controls build/test output panels independently of AI runs.
  const [localAction, setLocalAction] = useState<"build" | "test" | null>(null);
  const [localConsoleOutput, setLocalConsoleOutput] = useState("");
  const [localConsoleStatus, setLocalConsoleStatus] = useState<
    "idle" | "running" | "success" | "failed"
  >("idle");
  const localConsoleRef = useRef<HTMLPreElement>(null);
  const [localResult, setLocalResult] = useState<LocalProjectResult | null>(
    null,
  );
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [removingImportedProjectId, setRemovingImportedProjectId] = useState<
    string | null
  >(null);
  // Background run state is kept in a hook so polling and cancellation survive UI rerenders.
  const {
    status: generationStatus,
    operation: activeOperation,
    runId,
    error: generationError,
    isBusy,
    generate: runGeneration,
    review: runReview,
    reset: resetGeneration,
  } = useProjectGeneration();

  useEffect(() => {
    window.localStorage.setItem("devforge-ai-provider", selectedAIProvider);
  }, [selectedAIProvider]);

  useEffect(() => {
    const config = aiProviderConfigs.find(
      (item) => item.provider === providerSettingsProvider,
    );
    setProviderModelDraft(config?.model || "");
    setProviderBaseUrlDraft(config?.baseUrl || "");
    setProviderApiKeyDraft("");
  }, [aiProviderConfigs, providerSettingsProvider]);

  useEffect(() => {
    if (localConsoleRef.current) {
      localConsoleRef.current.scrollTop = localConsoleRef.current.scrollHeight;
    }
  }, [localConsoleOutput]);

  useEffect(() => {
    if (!editorJump || !workspaceEditorFile || !workspaceEditorRef.current) {
      return;
    }
    const editor = workspaceEditorRef.current;
    const lineStarts = [0];
    for (let index = 0; index < workspaceEditorDraft.length; index += 1) {
      if (workspaceEditorDraft[index] === "\n") lineStarts.push(index + 1);
    }
    const start = lineStarts[Math.max(0, editorJump.line - 1)] ?? 0;
    const position = Math.min(
      start + Math.max(0, (editorJump.column ?? 1) - 1),
      workspaceEditorDraft.length,
    );
    editor.focus();
    editor.setSelectionRange(position, position);
    editor.scrollTop = Math.max(0, (editorJump.line - 1) * 24);
    setEditorJump(null);
  }, [editorJump, workspaceEditorDraft, workspaceEditorFile]);

  function updateEditorCursor(textarea: HTMLTextAreaElement) {
    const beforeCursor = textarea.value.slice(0, textarea.selectionStart);
    const lines = beforeCursor.split("\n");
    setEditorCursor({ line: lines.length, column: lines.at(-1)!.length + 1 });
  }

  function appendLocalConsole(text: string) {
    setLocalConsoleOutput((current) => {
      const next = current + text;
      const maxLength = 100_000;
      return next.length > maxLength
        ? `[Earlier output omitted]\n${next.slice(-maxLength)}`
        : next;
    });
  }

  // Resolve any pending confirmation before closing the shared message modal.
  function closeModal(confirmed = false) {
    modalResolver.current?.(confirmed);
    modalResolver.current = null;
    setModal(null);
  }

  // Replace any current message with a non-blocking informational modal.
  function showModal(kind: ModalKind, title: string, message: string) {
    if (modalResolver.current) closeModal(false);
    setModal({ kind, title, message });
  }

  // Present a confirmation modal and return the user's explicit choice.
  function confirmModal(
    title: string,
    message: string,
    confirmLabel = "Continue",
  ): Promise<boolean> {
    if (modalResolver.current) closeModal(false);
    setModal({
      kind: "warning",
      title,
      message,
      confirmLabel,
      cancelLabel: "Cancel",
    });
    return new Promise((resolve) => {
      modalResolver.current = resolve;
    });
  }

  // Route asynchronous workflow errors through the shared modal presentation.
  useEffect(() => {
    if (workspaceBrowserError) {
      showModal("error", "Workspace error", workspaceBrowserError);
    }
  }, [workspaceBrowserError]);

  useEffect(() => {
    if (localAgentError)
      showModal("error", "Local Agent error", localAgentError);
  }, [localAgentError]);

  useEffect(() => {
    if (githubError) showModal("error", "GitHub error", githubError);
  }, [githubError]);

  useEffect(() => {
    if (generationError) {
      showModal("error", "Operation failed", generationError);
    }
  }, [generationError]);

  // Load the user's project list and select an initial project when available.
  async function load() {
    const projectResponse = await api.projects();
    setProjects(projectResponse.projects);
    if (!selected && projectResponse.projects[0]) {
      const first = await api.project(projectResponse.projects[0].id);
      setSelected(first.project);
    }
  }

  async function refreshAIProviders() {
    const response = await api.providers();
    setAIProviderConfigs(response.providers);
  }

  function selectProviderSettings(provider: AIProvider) {
    setProviderSettingsProvider(provider);
    const config = aiProviderConfigs.find((item) => item.provider === provider);
    setProviderModelDraft(config?.model || "");
    setProviderBaseUrlDraft(config?.baseUrl || "");
    setProviderApiKeyDraft("");
  }

  async function saveAIProviderSettings() {
    if (providerSaving) return;
    setProviderSaving(true);
    try {
      await api.saveAIProvider(providerSettingsProvider, {
        ...(providerApiKeyDraft.trim()
          ? { apiKey: providerApiKeyDraft.trim() }
          : {}),
        model: providerModelDraft.trim(),
        ...(providerSettingsProvider === "CUSTOM"
          ? { baseUrl: providerBaseUrlDraft.trim() }
          : {}),
      });
      setProviderApiKeyDraft("");
      await refreshAIProviders();
      setLogs((current) => [
        ...current,
        `${providerSettingsProvider} provider settings saved.`,
      ]);
      showModal(
        "success",
        "AI provider saved",
        "Provider settings were saved. The API key is encrypted and will not be shown again.",
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not save AI provider settings.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not save AI provider", message);
    } finally {
      setProviderSaving(false);
    }
  }

  async function removeAIProviderSettings() {
    const config = aiProviderConfigs.find(
      (item) => item.provider === providerSettingsProvider,
    );
    if (!config?.hasUserKey || providerSaving) return;
    if (
      !(await confirmModal(
        "Remove saved API key",
        `Remove your saved ${config.label} API key? The default server provider configuration, if any, will not be changed.`,
        "Remove key",
      ))
    ) {
      return;
    }
    setProviderSaving(true);
    try {
      await api.deleteAIProvider(providerSettingsProvider);
      setProviderApiKeyDraft("");
      await refreshAIProviders();
      setLogs((current) => [
        ...current,
        `Removed saved ${providerSettingsProvider} API key.`,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not remove the saved provider key.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not remove API key", message);
    } finally {
      setProviderSaving(false);
    }
  }

  useEffect(() => {
    load().catch((cause) => {
      const message =
        cause instanceof Error ? cause.message : "Could not load projects.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not load projects", message);
    });
    void refreshGitHubRepositories();
    void refreshAIProviders().catch((cause) => {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not load AI provider settings.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not load AI provider settings", message);
    });
    // Initial page load only. Selection changes are handled by the project buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the list of writable repositories used by the connect selector.
  async function refreshGitHubRepositories() {
    setGitHubError(null);
    setGitHubBusy("repositories");
    try {
      const response = await api.githubRepositories();
      setGitHubRepositories(response.repositories);
      setGitHubRepositorySelection((current) =>
        response.repositories.some(
          (repository) => repository.fullName === current,
        )
          ? current
          : response.repositories[0]?.fullName || "",
      );
    } catch (cause) {
      setGitHubError(
        cause instanceof Error
          ? cause.message
          : "Could not load repositories from GitHub.",
      );
    } finally {
      setGitHubBusy(null);
    }
  }

  // Create a blank project and initialize the workspace around it.
  async function create() {
    try {
      const response = await api.createProject({
        name: "New DevForge Project",
        description: "AI generated software project",
        stack: "TypeScript + React + PostgreSQL",
      });
      setProjects((current) => [response.project, ...current]);
      setSelected(response.project);
      setRenamingProject(false);
      setPrompt("");
      setChatMessages([]);
      resetGeneration();
      showModal(
        "success",
        "Project created",
        `Created "${response.project.name}".`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not create project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not create project", message);
    }
  }

  // Persist a project display name without changing its code or project settings.
  async function renameSelectedProject() {
    if (!selected || renameSaving) return;
    const name = renameDraft.trim();
    if (!name) {
      showModal("warning", "Project name required", "Enter a project name.");
      return;
    }
    if (name.length > 120) {
      showModal(
        "warning",
        "Project name too long",
        "Project names must be 120 characters or fewer.",
      );
      return;
    }
    if (name === selected.name) {
      setRenamingProject(false);
      return;
    }

    setRenameSaving(true);
    try {
      const response = await api.renameProject(selected.id, name);
      setSelected((current: any) =>
        current?.id === selected.id
          ? { ...current, ...response.project }
          : current,
      );
      setProjects((current) =>
        current.map((project) =>
          project.id === selected.id
            ? { ...project, ...response.project }
            : project,
        ),
      );
      setRenamingProject(false);
      setLogs((current) => [
        ...current,
        `Renamed project to "${response.project.name}".`,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not rename project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not rename project", message);
    } finally {
      setRenameSaving(false);
    }
  }

  // Permanently delete a project's DevForge records after explicit confirmation.
  async function deleteProject(project: { id: string; name: string }) {
    const confirmed = await confirmModal(
      "Delete project",
      `Permanently delete "${project.name}" and its saved artifacts, runs, and history? Any copy already synced to your PC will not be deleted.`,
      "Delete project",
    );
    if (!confirmed || deletingProjectId) return;

    setDeletingProjectId(project.id);
    try {
      await api.deleteProject(project.id);
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );

      if (selected?.id === project.id) {
        setSelected(undefined);
        setPrompt("");
        setLocalResult(null);
        resetGeneration();
      }

      setLogs((current) => [
        ...current,
        `Deleted project "${project.name}" and its saved data.`,
      ]);
      showModal(
        "success",
        "Project deleted",
        `Deleted "${project.name}" and its saved data.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not delete project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not delete project", message);
    } finally {
      setDeletingProjectId(null);
    }
  }

  // Remove only the DevForge copy of an import; source files on the PC are separate.
  async function removeImportedProject(project: { id: string; name: string }) {
    const confirmed = await confirmModal(
      "Remove imported project",
      `Remove "${project.name}" and its imported files, artifacts, and history from DevForge? The original project files on your PC will not be changed or deleted.`,
      "Remove from DevForge",
    );
    if (!confirmed || removingImportedProjectId || deletingProjectId) return;

    setRemovingImportedProjectId(project.id);
    try {
      await api.removeImportedProject(project.id);
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );

      if (selected?.id === project.id) {
        setSelected(undefined);
        setPrompt("");
        setLocalResult(null);
        resetGeneration();
      }

      setLogs((current) => [
        ...current,
        `Removed imported project "${project.name}" from DevForge. The local PC files were left untouched.`,
      ]);
      showModal(
        "success",
        "Imported project removed",
        `"${project.name}" and its DevForge copy were removed. The original files on your PC were left untouched.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not remove the imported project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not remove imported project", message);
    } finally {
      setRemovingImportedProjectId(null);
    }
  }

  // Clear the DevForge repository link without deleting the GitHub remote.
  async function disconnectGitHubRepository() {
    if (!selected?.githubOwner || !selected.githubRepository || githubBusy) {
      return;
    }

    const fullName = `${selected.githubOwner}/${selected.githubRepository}`;
    const confirmed = await confirmModal(
      "Disconnect GitHub repository",
      `Disconnect ${fullName} from "${selected.name}" in DevForge? This will not delete the GitHub repository or any files on your PC.`,
      "Disconnect repository",
    );
    if (!confirmed || githubBusy) return;

    setGitHubBusy("disconnect");
    setGitHubError(null);
    try {
      await api.disconnectGitHubRepository(selected.id);
      const [projectResponse, projectsResponse] = await Promise.all([
        api.project(selected.id),
        api.projects(),
      ]);
      setSelected(projectResponse.project);
      setProjects(projectsResponse.projects);
      setGitHubLocalPath(projectResponse.project.localPath || "");
      setLogs((current) => [
        ...current,
        `Disconnected ${fullName} from "${selected.name}". The GitHub repository and local files were left untouched.`,
      ]);
      showModal(
        "success",
        "Repository disconnected",
        `Disconnected ${fullName} from this DevForge project. The GitHub repository and local files were not changed.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not disconnect the GitHub repository.";
      setGitHubError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setGitHubBusy(null);
    }
  }

  // Start a new project generation or apply a request to the saved project files.
  async function generate(mode: "generate" | "modify" = "generate") {
    if (!selected || isBusy) return;
    if (!prompt.trim()) {
      const message =
        mode === "modify"
          ? "Describe the project changes you want."
          : "Enter a project description before generating.";
      setLogs((current) => [...current, message]);
      showModal(
        "warning",
        mode === "modify"
          ? "Modification request required"
          : "Project description required",
        message,
      );
      return;
    }

    const operationLabel =
      mode === "modify" ? "modification" : "project generation";
    if (!localAgentInfo && !localAgentConnecting) {
      void connectLocalAgent(true, true);
    }
    setLogs((current) => [...current, `Starting AI ${operationLabel}...`]);
    try {
      const completedRun = await runGeneration(
        selected.id,
        prompt,
        selectedAIProvider,
        mode,
      );
      if (!completedRun) return;
      setPrompt("");
      setLogs((current) => [
        ...current,
        `${mode === "modify" ? "Modification" : "Generation"} completed.`,
      ]);
      showModal(
        "success",
        mode === "modify" ? "Modification complete" : "Generation complete",
        mode === "modify"
          ? "The requested changes and updated project files have been saved."
          : "The generated project and plan have been saved.",
      );
      const [projectResponse, projectsResponse] = await Promise.all([
        api.project(selected.id),
        api.projects(),
      ]);
      setSelected(projectResponse.project);
      setProjects(projectsResponse.projects);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Generation failed.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal(
        "error",
        mode === "modify" ? "Modification failed" : "Generation failed",
        message,
      );
      // Keep the page usable after 400/409/network errors; the hook also clears its busy flag in finally.
    }
  }

  // Run a background AI review against the currently saved code artifact.
  async function review() {
    if (!selected || isBusy || !generatedFiles.length) return;

    setLogs((current) => [...current, "Starting AI code review..."]);
    const completedRun = await runReview(selected.id, selectedAIProvider);
    if (!completedRun) return;

    try {
      const [projectResponse, projectsResponse] = await Promise.all([
        api.project(selected.id),
        api.projects(),
      ]);
      setSelected(projectResponse.project);
      setProjects(projectsResponse.projects);
      setLogs((current) => [...current, "Code review completed and saved."]);
      showModal(
        "success",
        "Review complete",
        "The AI code review has been saved.",
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not load review results.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not load review", message);
    }
  }

  // Load a safe, relative directory listing from the paired Local Agent.
  async function loadWorkspaceDirectory(
    directory: string,
    token = localAgentToken,
  ) {
    setWorkspaceEntriesLoading(true);
    setWorkspaceBrowserError(null);
    try {
      const listing = await api.localAgent.workspaceFiles(token, directory);
      setWorkspaceListing(listing);
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error
          ? cause.message
          : "Could not load this workspace folder.",
      );
    } finally {
      setWorkspaceEntriesLoading(false);
    }
  }

  // Navigate to a workspace folder and keep the displayed location in sync.
  async function browseWorkspaceDirectory(directory: string) {
    if (
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !(await confirmModal(
        "Discard unsaved changes?",
        "Your unsaved edits will be lost if you open this folder.",
        "Discard changes",
      ))
    ) {
      return;
    }
    setWorkspaceEditorFile(null);
    setWorkspaceEditorDraft("");
    await loadWorkspaceDirectory(directory);
  }

  // Open an eligible text file and retain its timestamp for conflict-safe saving.
  async function openWorkspaceFile(entry: LocalWorkspaceEntry) {
    if (entry.type !== "file" || entry.editable === false) return;
    if (
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !(await confirmModal(
        "Discard unsaved changes?",
        "Your unsaved edits will be lost if you open another file.",
        "Discard changes",
      ))
    ) {
      return;
    }

    setWorkspaceBrowserError(null);
    try {
      const response = await api.localAgent.readWorkspaceFile(
        localAgentToken,
        entry.path,
      );
      setWorkspaceEditorFile(response.file);
      setWorkspaceEditorDraft(response.file.content);
      setEditorCursor({ line: 1, column: 1 });
      setEditorJump(null);
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error ? cause.message : "Could not open this file.",
      );
    }
  }

  // Save editor content only if the on-disk file has not changed since it was read.
  async function saveWorkspaceFile(): Promise<boolean> {
    if (!workspaceEditorFile || workspaceSaving) return false;
    setWorkspaceSaving(true);
    setWorkspaceBrowserError(null);
    try {
      const response = await api.localAgent.writeWorkspaceFile(
        localAgentToken,
        workspaceEditorFile,
        workspaceEditorDraft,
      );
      setWorkspaceEditorFile({
        ...workspaceEditorFile,
        content: workspaceEditorDraft,
        modifiedAt: response.file.modifiedAt,
      });
      setLogs((current) => [
        ...current,
        `Saved ${workspaceEditorFile.path} to your local workspace.`,
      ]);
      showModal(
        "success",
        "File saved",
        `Saved ${workspaceEditorFile.path} to your PC.`,
      );
      return true;
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error ? cause.message : "Could not save this file.",
      );
      return false;
    } finally {
      setWorkspaceSaving(false);
    }
  }

  // Open a build diagnostic in the matching generated file and select its reported line.
  async function openBuildDiagnostic(diagnostic: EditorDiagnostic) {
    if (!diagnostic.file || !selected || !localAgentToken) return;
    if (
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !(await confirmModal(
        "Discard unsaved changes?",
        "Opening the build error source will replace the current editor contents. Save your changes first or discard them to continue.",
        "Discard changes",
      ))
    ) {
      return;
    }
    const diagnosticPath = normalizeDiagnosticPath(diagnostic.file);
    const generatedFile = generatedFiles.find((file: any) => {
      if (typeof file?.path !== "string") return false;
      const candidate = normalizeDiagnosticPath(file.path);
      return (
        diagnosticPath === candidate ||
        diagnosticPath.endsWith(`/${candidate}`) ||
        candidate.endsWith(`/${diagnosticPath}`)
      );
    });
    if (!generatedFile || typeof generatedFile.path !== "string") {
      setWorkspaceBrowserError(
        `Could not match ${diagnostic.file} to a generated project file.`,
      );
      return;
    }

    const projectPath = `projects/${selected.id}`;
    const relativePath = `${projectPath}/${generatedFile.path.replaceAll("\\", "/")}`;
    setWorkspaceBrowserError(null);
    try {
      const response = await api.localAgent.readWorkspaceFile(
        localAgentToken,
        relativePath,
      );
      setWorkspaceEditorFile(response.file);
      setWorkspaceEditorDraft(response.file.content);
      setEditorCursor({
        line: diagnostic.line ?? 1,
        column: diagnostic.column ?? 1,
      });
      setEditorJump(
        diagnostic.line
          ? { line: diagnostic.line, column: diagnostic.column }
          : null,
      );
      if (workspaceListing?.path !== projectPath) {
        await loadWorkspaceDirectory(projectPath);
      }
      document.getElementById("local-workspace-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error
          ? cause.message
          : "Could not open the source file for this build error.",
      );
    }
  }

  // Launch the installed Windows agent on demand, then pair through loopback.
  async function connectLocalAgent(startAgent = true, quiet = false) {
    if (localAgentConnecting) return;
    if (startAgent) window.location.href = "devforge-agent://start";
    setLocalAgentConnecting(true);
    setLocalAgentError(null);
    try {
      let token = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        try {
          token = await api.localAgent.pair();
          break;
        } catch (cause) {
          lastError = cause;
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }
      if (!token) {
        throw lastError instanceof Error
          ? new Error(
              `${lastError.message} Install or update the Local Agent from the User guide, then try again.`,
            )
          : new Error(
              "The Local Agent did not start. Install it from the User guide, then try again.",
            );
      }
      const result = await api.localAgent.health(token);
      window.localStorage.setItem("devforge-local-agent-token", token);
      setLocalAgentToken(token);
      setLocalAgentInfo(result);
      await loadWorkspaceDirectory("", token);
      try {
        const response = await api.localAgent.workspaceProjects(token);
        setWorkspaceProjects(response.projects);
        setLocalImportPath((current) =>
          response.projects.some((project) => project.path === current)
            ? current
            : response.projects[0]?.path || "",
        );
      } catch (cause) {
        setWorkspaceProjects([]);
        setLocalAgentError(
          cause instanceof Error
            ? cause.message
            : "Could not list folders in the agent workspace.",
        );
      }
    } catch (cause) {
      setLocalAgentInfo(null);
      setWorkspaceProjects([]);
      setWorkspaceListing(null);
      setWorkspaceEditorFile(null);
      setWorkspaceEditorDraft("");
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not connect to the local agent.";
      setLocalAgentError(message);
      if (!quiet) {
        setLogs((current) => [...current, `ERROR: ${message}`]);
      }
    } finally {
      setLocalAgentConnecting(false);
    }
  }

  // Stop using the paired agent in this browser without touching the agent process.
  function disconnectLocalAgent() {
    window.localStorage.removeItem("devforge-local-agent-token");
    setLocalAgentToken("");
    setLocalAgentInfo(null);
    setLocalAgentError(null);
    setWorkspaceProjects([]);
    setWorkspaceListing(null);
    setWorkspaceEditorFile(null);
    setWorkspaceEditorDraft("");
    setLogs((current) => [
      ...current,
      "Disconnected the Local Agent from this browser session.",
    ]);
  }

  // Import a bounded, secret-filtered snapshot from a selected local folder.
  async function importLocalProject() {
    const source = workspaceProjects.find(
      (project) => project.path === localImportPath,
    );
    if (!source || !localAgentInfo || importingProject) return;

    if (
      !(await confirmModal(
        "Import local project",
        `Import text files from "${source.path}" into your DevForge account? Files are uploaded to the server for storage and AI review. Secret environment files and generated dependency/build folders are excluded; review source files for other credentials before importing.`,
        "Import project",
      ))
    ) {
      return;
    }

    setImportingProject(true);
    setLocalAgentError(null);
    try {
      const localProject = await api.localAgent.importProject(
        localAgentToken,
        source.path,
      );
      const response = await api.importProject(
        localProject.project,
        localProject.project.name,
      );
      setProjects((current) => [response.project, ...current]);
      setSelected(response.project);
      setPrompt("");
      setChatMessages([]);
      setLocalResult(null);
      resetGeneration();
      setLogs((current) => [
        ...current,
        `Imported ${localProject.project.files.length} files from ${source.path}. The project is ready for AI review and local build/test.`,
      ]);
      showModal(
        "success",
        "Project imported",
        `Imported ${localProject.project.files.length} files from ${source.path}.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not import the local project.";
      setLocalAgentError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setImportingProject(false);
    }
  }

  // Optionally sync saved files first, then explicitly confirm before running scripts.
  async function runLocalAction(
    action: "build" | "test",
    syncBeforeRun = true,
  ) {
    if (!selected || !localAgentInfo || !generatedFiles.length || localAction) {
      return;
    }
    const localPath = `projects/${selected.id}`;
    const workspaceMatchesProject =
      workspaceListing?.path === localPath ||
      workspaceListing?.path.startsWith(`${localPath}/`);
    if (!syncBeforeRun && !workspaceMatchesProject) return;

    const label = action === "build" ? "build" : "test";
    if (
      !(await confirmModal(
        syncBeforeRun ? `Run local ${label}` : `Run ${label} on local edits`,
        syncBeforeRun
          ? `This will copy the generated files to your PC (overwriting matching files in this DevForge project folder) and run the project's ${label} scripts locally. Project scripts may execute arbitrary code. Continue only if you trust this generated project.`
          : `This will run the ${label} scripts against the existing local project files without syncing or overwriting them. Project scripts may execute arbitrary code. Continue only if you trust this project.`,
        `Run ${label}`,
      ))
    ) {
      return;
    }

    if (
      !syncBeforeRun &&
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !(await saveWorkspaceFile())
    ) {
      return;
    }

    setLocalAction(action);
    setLocalResult(null);
    setLocalConsoleOutput("");
    setLocalConsoleStatus("running");
    appendLocalConsole(`$ Preparing local ${label}...\n`);

    try {
      let actionPath = localPath;
      if (syncBeforeRun) {
        const synced = await api.localAgent.syncProject(
          localAgentToken,
          localPath,
          generatedFiles,
        );
        actionPath = synced.path;
        setLogs((current) => [
          ...current,
          `Copied ${synced.files} generated files to ${synced.path} on ${localAgentInfo.machine}.`,
        ]);

        appendLocalConsole(
          `Copied ${synced.files} generated files to ${synced.path}\n`,
        );
      } else {
        appendLocalConsole(
          `Using existing local project files at ${localPath}\n`,
        );
      }
      const responseResult = await api.localAgent.runProjectStreaming(
        localAgentToken,
        action,
        actionPath,
        (event: LocalProjectStreamEvent) => {
          if (event.type === "notice") {
            appendLocalConsole(`\n[notice] ${event.message}\n\n`);
          } else if (event.type === "stage-start") {
            appendLocalConsole(`\n> ${event.name}: ${event.command}\n`);
          } else if (event.type === "output") {
            appendLocalConsole(
              `${event.stream === "stderr" ? "[stderr] " : ""}${event.text}`,
            );
          } else if (event.type === "stage-complete") {
            appendLocalConsole(`\n[exit ${event.stage.code ?? "unknown"}]\n`);
            if (
              /No supported build\/test configuration was found/i.test(
                event.stage.stderr,
              )
            ) {
              appendLocalConsole(
                "[notice] Restart the Local Agent from the updated DevForge source so it can detect build configurations inside application subfolders. If this remains afterward, the generated project needs a supported build configuration.\n",
              );
            }
            if (event.stage.truncated) {
              appendLocalConsole("[Output truncated at 128 KB]\n");
            }
          } else if (event.type === "complete") {
            setLocalResult(event.result);
            setLocalConsoleStatus(event.result.success ? "success" : "failed");
          }
        },
      );
      for (const stage of responseResult.stages) {
        const state = stage.code === 0 ? "passed" : "failed";
        setLogs((current) => [
          ...current,
          `${stage.name} ${state} (${stage.command}, exit ${stage.code ?? "unknown"}).`,
        ]);
      }
      if (!responseResult.stages.length) {
        setLogs((current) => [
          ...current,
          `The local agent did not run a ${label} command.`,
        ]);
      }
      if (!responseResult.success) {
        setLocalConsoleStatus("failed");
        setLogs((current) => [
          ...current,
          `Local ${label} failed. See the command output below.`,
        ]);
        showModal(
          "warning",
          `Local ${label} did not pass`,
          `The local ${label} operation did not succeed. Review the command output for details.`,
        );
      } else {
        showModal(
          "success",
          `Local ${label} complete`,
          `The local ${label} operation completed successfully.`,
        );
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : `Local ${label} failed.`;
      setLocalConsoleStatus("failed");
      appendLocalConsole(`\nERROR: ${message}\n`);
      setLocalAgentError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setLocalAction(null);
    }
  }

  // Copy the current saved code artifact into the selected Local Agent workspace path.
  async function syncGeneratedFiles() {
    if (
      !selected ||
      !localAgentInfo ||
      !generatedFiles.length ||
      syncingGeneratedFiles ||
      localAction
    ) {
      return;
    }

    const localPath = `projects/${selected.id}`;
    if (
      !(await confirmModal(
        "Sync files to PC",
        `Copy ${generatedFiles.length} generated files to ${localAgentInfo.workspaceRoot}\\${localPath.replaceAll("/", "\\")}? Matching files in this DevForge project folder will be overwritten.`,
        "Sync files",
      ))
    ) {
      return;
    }

    setSyncingGeneratedFiles(true);
    setLocalAgentError(null);
    try {
      const synced = await api.localAgent.syncProject(
        localAgentToken,
        localPath,
        generatedFiles,
      );
      setWorkspaceEditorFile(null);
      setWorkspaceEditorDraft("");
      await loadWorkspaceDirectory(synced.path);
      setLogs((current) => [
        ...current,
        `Copied ${synced.files} generated files to ${synced.path} on ${localAgentInfo.machine}. The folder is open in Local workspace files.`,
      ]);
      showModal(
        "success",
        "Files synced to PC",
        `Copied ${synced.files} files to ${synced.path}.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not copy generated files to your PC.";
      setLocalAgentError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setSyncingGeneratedFiles(false);
    }
  }

  // Download the saved project as a ZIP without requiring a Local Agent connection.
  async function downloadProjectZip() {
    if (!selected || !generatedFiles.length || downloadingProjectZip) return;

    setDownloadingProjectZip(true);
    try {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const projectFolder =
        selected.name
          ?.normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^[.-]+|[.-]+$/g, "")
          .slice(0, 80) || selected.id;
      const fileTree: Record<string, Record<string, Uint8Array>> = {
        [projectFolder]: Object.create(null) as Record<string, Uint8Array>,
      };
      const seenPaths = new Set<string>();

      for (const file of generatedFiles) {
        if (
          !file ||
          typeof file.path !== "string" ||
          typeof file.content !== "string"
        ) {
          throw new Error("The saved project contains an invalid file.");
        }
        const relativePath = file.path.replaceAll("\\", "/");
        const segments = relativePath.split("/");
        if (
          !relativePath ||
          relativePath.startsWith("/") ||
          /^[a-zA-Z]:/.test(relativePath) ||
          segments.some(
            (segment: string) =>
              !segment ||
              segment === "." ||
              segment === ".." ||
              /[\u0000-\u001f]/.test(segment),
          )
        ) {
          throw new Error(
            `The saved project has an unsafe file path: ${file.path}`,
          );
        }

        const archivePath = segments.join("/");
        const pathKey = archivePath.toLowerCase();
        if (seenPaths.has(pathKey)) {
          throw new Error(
            `The saved project has a duplicate file: ${file.path}`,
          );
        }
        seenPaths.add(pathKey);
        fileTree[projectFolder][archivePath] = strToU8(file.content);
      }

      const archive = zipSync(fileTree, { level: 6 });
      const blob = new Blob([archive], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectFolder}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLogs((current) => [
        ...current,
        `Downloaded ${generatedFiles.length} project files as ${link.download}.`,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not create a ZIP download for this project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Project download failed", message);
    } finally {
      setDownloadingProjectZip(false);
    }
  }

  // Read the active GitHub link in the shape expected by Local Agent requests.
  function linkedGitHubRepository() {
    if (!selected?.githubOwner || !selected?.githubRepository) return null;
    return {
      owner: selected.githubOwner as string,
      repository: selected.githubRepository as string,
      branch: (selected.githubBranch || "main") as string,
    };
  }

  // Resolve the user-selected path, saved path, or default project workspace path.
  function currentGitHubPath() {
    return (
      githubLocalPath.trim() ||
      selected?.localPath ||
      (selected ? `projects/${selected.id}-github` : "")
    );
  }

  // Reload the selected project so persisted repository or sync state is reflected.
  async function refreshSelectedProject() {
    if (!selected) return;
    const [projectResponse, projectsResponse] = await Promise.all([
      api.project(selected.id),
      api.projects(),
    ]);
    setSelected(projectResponse.project);
    setProjects(projectsResponse.projects);
  }

  // Connect the repository currently selected in the writable-repository list.
  async function connectSelectedGitHubRepository() {
    if (!selected || !githubRepositorySelection || githubBusy) return;
    const [ownerName, ...repositoryParts] =
      githubRepositorySelection.split("/");
    const repository = repositoryParts.join("/");
    if (!ownerName || !repository) return;

    setGitHubBusy("connect");
    setGitHubError(null);
    try {
      await api.connectGitHubRepository(selected.id, ownerName, repository);
      setGitHubLocalPath(
        selected.localPath || `projects/${selected.id}-github`,
      );
      await refreshSelectedProject();
      setLogs((current) => [
        ...current,
        `Connected ${githubRepositorySelection} to "${selected.name}".`,
      ]);
      showModal(
        "success",
        "Repository connected",
        `Connected ${githubRepositorySelection} to "${selected.name}".`,
      );
    } catch (cause) {
      setGitHubError(
        cause instanceof Error
          ? cause.message
          : "Could not connect this repository.",
      );
    } finally {
      setGitHubBusy(null);
    }
  }

  // Create a GitHub repository using the chosen name and visibility.
  async function createGitHubRepository() {
    if (!selected || !githubNewRepository.trim() || githubBusy) return;
    setGitHubBusy("create");
    setGitHubError(null);
    try {
      const response = await api.createGitHubRepository(
        selected.id,
        githubNewRepository.trim(),
        selected.description || `Created with DevForge AI: ${selected.name}`,
        githubNewRepositoryPrivate,
      );
      setGitHubLocalPath(
        selected.localPath || `projects/${selected.id}-github`,
      );
      await refreshSelectedProject();
      await refreshGitHubRepositories();
      setLogs((current) => [
        ...current,
        `Created and connected ${response.repository.private ? "private" : "public"} repository ${response.repository.fullName}.`,
      ]);
      showModal(
        "success",
        `${response.repository.private ? "Private" : "Public"} repository created`,
        `Created and connected ${response.repository.fullName}.`,
      );
    } catch (cause) {
      setGitHubError(
        cause instanceof Error
          ? cause.message
          : "Could not create a GitHub repository.",
      );
    } finally {
      setGitHubBusy(null);
    }
  }

  // Clone the linked repository into a new Local Agent workspace folder.
  async function cloneGitHubRepository() {
    const repository = linkedGitHubRepository();
    const path = currentGitHubPath();
    if (!selected || !repository || !localAgentInfo || !path || githubBusy)
      return;
    if (
      !(await confirmModal(
        "Clone GitHub repository",
        `Clone https://github.com/${repository.owner}/${repository.repository} into ${localAgentInfo.workspaceRoot}\\${path.replaceAll("/", "\\")}? The destination must not already exist. Git uses the credentials configured on this PC; DevForge will not send your GitHub token to the Local Agent.`,
        "Clone repository",
      ))
    ) {
      return;
    }

    setGitHubBusy("clone");
    setGitHubError(null);
    try {
      const result = await api.localAgent.cloneGitHubRepository(
        localAgentToken,
        {
          ...repository,
          path,
        },
      );
      await api.updateGitHubSync(selected.id, result.path, "CONNECTED");
      setGitHubLocalPath(result.path);
      setWorkspaceEditorFile(null);
      setWorkspaceEditorDraft("");
      await Promise.all([
        loadWorkspaceDirectory(result.path),
        refreshSelectedProject(),
      ]);
      setLogs((current) => [
        ...current,
        `Cloned ${repository.owner}/${repository.repository} to ${result.path}.`,
      ]);
      showModal(
        "success",
        "Repository cloned",
        `Cloned ${repository.owner}/${repository.repository} to ${result.path}.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not clone the GitHub repository.";
      setGitHubError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setGitHubBusy(null);
    }
  }

  // Fast-forward the local branch only when there are no uncommitted changes.
  async function pullGitHubRepository() {
    const repository = linkedGitHubRepository();
    const path = currentGitHubPath();
    if (!selected || !repository || !localAgentInfo || !path || githubBusy)
      return;
    if (
      !(await confirmModal(
        "Pull from GitHub",
        `Pull the latest ${repository.branch} branch into ${path}? Pull is allowed only when the local repository has no uncommitted changes.`,
        "Pull latest",
      ))
    ) {
      return;
    }

    setGitHubBusy("pull");
    setGitHubError(null);
    try {
      const result = await api.localAgent.pullGitHubRepository(
        localAgentToken,
        {
          ...repository,
          path,
        },
      );
      await api.updateGitHubSync(selected.id, result.path, "CLEAN");
      await Promise.all([
        loadWorkspaceDirectory(result.path),
        refreshSelectedProject(),
      ]);
      setLogs((current) => [
        ...current,
        `Pulled ${repository.owner}/${repository.repository}: ${result.output}`,
      ]);
      showModal(
        "success",
        "Pull complete",
        result.output || `Pulled ${repository.owner}/${repository.repository}.`,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not pull from GitHub.";
      setGitHubError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setGitHubBusy(null);
    }
  }

  // Optionally configure Git, then stage, commit, and push reviewed workspace changes.
  async function pushGitHubRepository(initializeRepository = false) {
    const repository = linkedGitHubRepository();
    const path = currentGitHubPath();
    if (!selected || !repository || !localAgentInfo || !path || githubBusy)
      return;
    if (
      !(await confirmModal(
        initializeRepository
          ? "Initialize and push to GitHub"
          : "Commit and push to GitHub",
        `${initializeRepository ? `Configure or initialize Git in ${path}, then ` : ""}${generatedFiles.length ? `copy ${generatedFiles.length} saved DevForge files into ${path} (matching files will be overwritten), then ` : ""}stage and commit all changes in ${path} and push them to ${repository.owner}/${repository.repository} (${repository.branch})? Secret environment files and common private keys are blocked. Review your project before publishing.`,
        initializeRepository ? "Initialize & push" : "Commit & push",
      ))
    ) {
      return;
    }

    setGitHubBusy("push");
    setGitHubError(null);
    try {
      if (generatedFiles.length) {
        await api.localAgent.syncProject(localAgentToken, path, generatedFiles);
      }
      if (initializeRepository) {
        await api.localAgent.initializeGitHubRepository(localAgentToken, {
          ...repository,
          path,
        });
      }
      const result = await api.localAgent.pushGitHubRepository(
        localAgentToken,
        {
          ...repository,
          path,
          message:
            githubCommitMessage.trim() || `Sync ${selected.name} from DevForge`,
        },
      );
      await api.updateGitHubSync(selected.id, result.path, "CLEAN");
      setWorkspaceEditorFile(null);
      setWorkspaceEditorDraft("");
      await Promise.all([
        loadWorkspaceDirectory(result.path),
        refreshSelectedProject(),
      ]);
      showModal(
        "success",
        "Push complete",
        result.commit ||
          result.output ||
          `Pushed ${repository.owner}/${repository.repository}.`,
      );
      setLogs((current) => [
        ...current,
        `Pushed ${repository.owner}/${repository.repository}: ${result.commit || result.output}`,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not push to GitHub.";
      setGitHubError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setGitHubBusy(null);
    }
  }

  // Load a project and reset project-specific editor and operation state.
  async function selectProject(projectId: string) {
    try {
      const response = await api.project(projectId);
      setSelected(response.project);
      setRenamingProject(false);
      setGitHubLocalPath(response.project.localPath || "");
      setPrompt("");
      setChatMessages([]);
      resetGeneration();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not open project.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not open project", message);
    }
  }

  // Write the selected project's generated files to a PC folder without any
  // Local Agent, using the browser folder picker.
  async function saveGeneratedFilesToLocalPc(): Promise<boolean> {
    if (!generatedFiles.length) return false;
    const ok = await saveGeneratedFilesToLocalPcGeneric(
      generatedFiles,
      selected?.name || "devforge-project",
    );
    if (ok) {
      setLogs((current) => [
        ...current,
        `Saved ${generatedFiles.length} generated file(s) to a local folder on your PC.`,
      ]);
      showModal(
        "success",
        "Files saved to PC",
        `Wrote ${generatedFiles.length} file(s) into the folder you selected.`,
      );
    }
    return ok;
  }

  // Every AI process runs from chat: plain questions are answered, and
  // requests like "generate...", "modify...", "review...", or "build/test"
  // trigger the matching DevForge workflow and report each step in the chat.
  async function sendChatMessage() {
    const question = chatInput.trim();
    if (!selected || !question || chatBusy) return;

    const intent = detectChatIntent(question);
    const nextMessages: ChatMessage[] = [
      ...chatMessages.slice(-11),
      { role: "user", content: question },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    setLastFailedChatQuestion(null);
    const say = (text: string) =>
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: text },
      ]);
    try {
      if (intent === "generate" || intent === "modify") {
        const requestText = stripIntentKeywords(question);
        if (intent === "modify" && !generatedFiles.length) {
          say(
            "There are no generated files yet. Describe the project you want and I will generate it first.",
          );
          return;
        }
        say(
          intent === "modify"
            ? `Applying your modification request${requestText ? `: “${requestText}”` : ""}. Steps: plan → generate → save files.`
            : `Starting project generation${requestText ? `: “${requestText}”` : ""}. Steps: plan → generate → save files.`,
        );
        const completedRun = await runGeneration(
          selected.id,
          requestText || prompt || selected.description || selected.name,
          selectedAIProvider,
          intent,
        );
        if (!completedRun) {
          say(
            generationError
              ? `The ${intent} run failed: ${generationError}`
              : `The ${intent} run did not complete. Check recent activity and retry.`,
          );
          return;
        }
        const [projectResponse, projectsResponse] = await Promise.all([
          api.project(selected.id),
          api.projects(),
        ]);
        setSelected(projectResponse.project);
        setProjects(projectsResponse.projects);
        setPrompt("");
        const count = Array.isArray(projectResponse.project.artifacts)
          ? (
              projectResponse.project.artifacts.find(
                (artifact: any) => artifact.type === "CODE",
              )?.content ?? []
            ).length
          : 0;
        say(
          `${intent === "modify" ? "Modification" : "Generation"} complete. ${count} file(s) are saved in the project. Use “Save to my PC” in the generated files panel (or ask me to) to write them to a local folder.`,
        );
        return;
      }
      if (intent === "review") {
        if (!generatedFiles.length) {
          say(
            "Nothing to review yet — generate the project code first, then ask me to review it.",
          );
          return;
        }
        say("Running an AI code review. Steps: analyze → findings → save.");
        const completedRun = await runReview(selected.id, selectedAIProvider);
        if (!completedRun) {
          say(
            generationError
              ? `The review run failed: ${generationError}`
              : "The review run did not complete. Check recent activity and retry.",
          );
          return;
        }
        const [projectResponse] = await Promise.all([api.project(selected.id)]);
        setSelected(projectResponse.project);
        const artifacts = Array.isArray(projectResponse.project.artifacts)
          ? projectResponse.project.artifacts
          : [];
        const latest = [...artifacts]
          .reverse()
          .find((artifact: any) => artifact.type === "REVIEW");
        const summary = latest?.content?.summary;
        const findings = Array.isArray(latest?.content?.findings)
          ? latest.content.findings
          : [];
        say(
          `Review complete: ${findings.length} finding(s).${summary ? `\n\nSummary: ${summary}` : ""}\nFull details are in the Latest AI code review panel.`,
        );
        return;
      }
      if (intent === "connect-agent") {
        say("Connecting the Local Agent on this PC…");
        await connectLocalAgent();
        say(
          localAgentInfo
            ? `Connected to ${localAgentInfo.machine} (${localAgentInfo.platform}). Workspace: ${localAgentInfo.workspaceRoot}`
            : "Could not connect the Local Agent. Install or update it from the Local Agent install guide, then try again.",
        );
        return;
      }
      if (intent === "disconnect-agent") {
        disconnectLocalAgent();
        say(
          "Disconnected the Local Agent from this browser. Build, test, sync, and GitHub operations are paused until you connect again.",
        );
        return;
      }
      if (intent === "build" || intent === "test") {
        if (!localAgentInfo) {
          say(
            `A Local Agent connection is required to run ${intent === "build" ? "a build" : "tests"} on your PC. Ask me to "connect the agent" first, or just ask for the ${intent === "build" ? "build" : "test"} strategy instead.`,
          );
        } else {
          say(`Starting the local ${intent} workflow…`);
          await runLocalAction(intent);
          say(
            `Local ${intent} finished. Output is in the command console panel; ask me to analyze any errors you see.`,
          );
        }
        // Fall through to the AI answer for follow-up guidance below.
      }
      if (intent === "save") {
        if (!generatedFiles.length) {
          say("There are no generated files to save yet.");
          return;
        }
        say("Choose a local folder in the browser dialog to save the files…");
        const saved = await saveGeneratedFilesToLocalPc();
        say(
          saved
            ? `Saved ${generatedFiles.length} file(s) to the folder you selected on your PC.`
            : "Folder save was cancelled or is not supported in this browser. Use “Download ZIP” instead — it needs no special permission.",
        );
        return;
      }

      // Plain assistant question.
      const response = await api.chat(
        selected.id,
        nextMessages,
        selectedAIProvider,
      );
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: response.answer },
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not get an AI response.";
      const canRetry = isRetryableAiRequestError(cause);
      // Transient AI/network failures are retried automatically before an error is shown.
      if (canRetry) {
        say(
          `The AI request failed transiently (${message}). Retrying automatically…`,
        );
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 750 * attempt),
            );
            const response = await api.chat(
              selected.id,
              nextMessages,
              selectedAIProvider,
            );
            setChatMessages((current) => [
              ...current,
              { role: "assistant", content: response.answer },
            ]);
            setChatBusy(false);
            return;
          } catch (retryCause) {
            cause = retryCause;
          }
        }
      }
      const finalMessage =
        cause instanceof Error
          ? cause.message
          : "Could not get an AI response.";
      setLastFailedChatQuestion(question);
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Sorry, that failed: ${finalMessage}`,
        },
      ]);
      showModal("error", "Chat request failed", finalMessage);
    } finally {
      setChatBusy(false);
    }
  }

  // Derive the current saved code, plans, and review data for the workspace panels.
  const artifacts = Array.isArray(selected?.artifacts)
    ? selected.artifacts
    : [];
  const codeArtifact = artifacts.find(
    (artifact: any) => artifact.type === "CODE",
  );
  const codeContent = codeArtifact?.content;
  const generatedFiles = Array.isArray(codeContent) ? codeContent : [];
  const buildDiagnostics = parseBuildDiagnostics(localResult);
  const selectedWorkspacePath = selected ? `projects/${selected.id}` : "";
  const workspaceMatchesSelectedProject =
    workspaceListing?.path === selectedWorkspacePath ||
    Boolean(
      selectedWorkspacePath &&
      workspaceListing?.path.startsWith(`${selectedWorkspacePath}/`),
    );
  const editorLineCount = Math.max(1, workspaceEditorDraft.split("\n").length);
  const editorFileName = workspaceEditorFile?.path.split(/[\\/]/).at(-1) || "";
  const editorLanguage =
    editorFileName.split(".").at(-1)?.toUpperCase() || "TEXT";
  const editorFileDiagnostics = buildDiagnostics.filter((diagnostic) => {
    if (!diagnostic.file || !workspaceEditorFile) return false;
    const errorPath = normalizeDiagnosticPath(diagnostic.file);
    const editorPath = normalizeDiagnosticPath(workspaceEditorFile.path);
    return (
      errorPath === editorPath ||
      errorPath.endsWith(`/${editorPath}`) ||
      editorPath.endsWith(`/${errorPath}`)
    );
  });
  const reviewArtifacts = artifacts.filter(
    (artifact: any) =>
      artifact.type === "REVIEW" &&
      artifact.content?.codeArtifactId === codeArtifact?.id,
  );
  const latestReview = reviewArtifacts[reviewArtifacts.length - 1];
  const reviewContent = latestReview?.content;
  const reviewFindings = Array.isArray(reviewContent?.findings)
    ? reviewContent.findings
    : [];

  // Render the project sidebar, artifact workspace, Local Agent, and GitHub panels.
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Global session status and sign-out controls. */}
      <header className="h-16 border-b border-slate-800 px-5 flex items-center justify-between">
        <BrandWordmark />
        <div className="flex gap-4 items-center text-sm">
          {(user as User).role === "ADMIN" && (
            <a
              href="/admin"
              className="text-indigo-300 transition hover:text-white"
            >
              Admin
            </a>
          )}
          <a
            href="/guide"
            className="text-slate-300 transition hover:text-white"
          >
            User guide
          </a>
          <span
            className={localAgentInfo ? "text-emerald-400" : "text-amber-400"}
          >
            ● Local Agent {localAgentInfo ? "Connected" : "Not connected"}
          </span>
          <span className="text-slate-400">
            {user.githubUsername || user.email}
          </span>
          <button
            onClick={() => api.logout().then(() => location.reload())}
            className="text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>
      {showApiLoading && (
        <div
          className="api-loading-indicator"
          role="status"
          aria-live="polite"
          aria-label="Waiting for an API response"
        >
          <span className="api-loading-spinner" aria-hidden="true" />
          <span>Waiting for response...</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-[250px_1fr_350px] min-h-0">
        {/* Project navigation exposes distinct remove-import and permanent-delete actions. */}
        <aside className="border-r border-slate-800 p-4 overflow-auto">
          <button
            onClick={create}
            className="w-full bg-indigo-600 rounded-lg py-2 mb-5"
          >
            + New Project
          </button>
          <div className="text-xs uppercase text-slate-500 mb-2">Projects</div>
          {projects.map((project) => {
            const isImportedProject =
              project.stack === "Imported project" &&
              project.description?.startsWith("Imported from local workspace:");
            const actionDisabled =
              deletingProjectId !== null || removingImportedProjectId !== null;

            return (
              <div
                key={project.id}
                className={`mb-1 rounded-lg ${selected?.id === project.id ? "bg-slate-800" : "hover:bg-slate-900"}`}
              >
                <button
                  onClick={() => void selectProject(project.id)}
                  className="block w-full rounded-t-lg p-3 text-left"
                >
                  <div>{project.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {project.status}
                  </div>
                </button>
                {isImportedProject && (
                  <button
                    type="button"
                    disabled={actionDisabled}
                    onClick={() => void removeImportedProject(project)}
                    className="block w-full px-3 pb-1 text-left text-xs text-slate-500 transition hover:text-amber-300 disabled:cursor-wait disabled:opacity-50"
                    aria-label={`Remove imported ${project.name} from DevForge`}
                  >
                    {removingImportedProjectId === project.id
                      ? "Removing..."
                      : "Remove imported project"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionDisabled}
                  onClick={() => void deleteProject(project)}
                  className="block w-full rounded-b-lg px-3 pb-2 text-left text-xs text-slate-500 transition hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
                  aria-label={`Delete ${project.name}`}
                >
                  {deletingProjectId === project.id
                    ? "Deleting..."
                    : "Delete project"}
                </button>
              </div>
            );
          })}
        </aside>

        {/* Selected project editor, saved artifacts, and local development tools. */}
        <main className="min-w-0 overflow-auto p-6">
          {!selected ? (
            <div className="h-full grid place-items-center text-slate-500">
              Create a project to begin.
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <div>
                  {renamingProject ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void renameSelectedProject();
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Project name"
                        maxLength={120}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        disabled={renameSaving}
                        className="min-w-[16rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={renameSaving || !renameDraft.trim()}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        {renameSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={renameSaving}
                        onClick={() => setRenamingProject(false)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold">{selected.name}</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameDraft(selected.name);
                          setRenamingProject(true);
                        }}
                        className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-indigo-400 hover:text-indigo-200"
                      >
                        Rename
                      </button>
                    </div>
                  )}
                  <p className="text-slate-400 mt-1">{selected.description}</p>
                </div>
                <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs">
                  {selected.status}
                </span>
              </div>

              <div className="mt-6 glass rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGeneratedExplorerExpanded((expanded) => !expanded)
                    }
                    aria-expanded={generatedExplorerExpanded}
                    aria-controls="generated-explorer-files"
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    title={
                      generatedExplorerExpanded
                        ? "Minimize generated files list"
                        : "Expand generated files list"
                    }
                  >
                    <span
                      className={`inline-block w-4 text-center text-indigo-300 transition-transform ${
                        generatedExplorerExpanded ? "rotate-0" : "-rotate-90"
                      }`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                    Explorer
                    <span className="text-xs font-normal text-slate-500">
                      {generatedFiles.length} files
                    </span>
                  </button>
                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    List height
                    <select
                      value={generatedExplorerHeight}
                      onChange={(event) =>
                        setGeneratedExplorerHeight(
                          event.target.value === "max" ? "max" : "min",
                        )
                      }
                      disabled={!generatedExplorerExpanded}
                      aria-label="Generated Explorer file list height"
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </label>
                </div>
                <div
                  id="generated-explorer-files"
                  className={`overflow-auto p-4 font-mono text-sm ${
                    !generatedExplorerExpanded
                      ? "hidden"
                      : generatedExplorerHeight === "min"
                        ? "max-h-[220px]"
                        : "max-h-[600px]"
                  }`}
                >
                  {generatedFiles.length ? (
                    generatedFiles.map((file: any, index: number) => (
                      <div
                        key={file.path || index}
                        className="truncate py-1 text-slate-300"
                        title={file.path}
                      >
                        {file.path}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">
                      No generated files saved yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Workspace files are browsed and edited through the loopback agent only. */}
              <section
                className="mt-5 glass overflow-hidden rounded-2xl"
                aria-label="Local code editor and workspace browser"
                id="local-workspace-editor"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                  <div>
                    <h3 className="font-semibold">Code Editor</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {workspaceListing
                        ? `${localAgentInfo?.workspaceRoot}${workspaceListing.path ? `\\${workspaceListing.path.replaceAll("/", "\\")}` : ""}`
                        : "Connect the Local Agent to edit files on your PC."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {workspaceListing?.parent !== null &&
                      workspaceListing?.parent !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            void browseWorkspaceDirectory(
                              workspaceListing.parent!,
                            )
                          }
                          disabled={workspaceEntriesLoading}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 disabled:opacity-50"
                        >
                          Up
                        </button>
                      )}
                    {workspaceMatchesSelectedProject && (
                      <button
                        type="button"
                        onClick={() => void runLocalAction("build", false)}
                        disabled={
                          !localAgentInfo ||
                          Boolean(localAction) ||
                          !generatedFiles.length
                        }
                        title="Build the existing local project without syncing over your edits."
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {localAction === "build"
                          ? "Building..."
                          : "Build edited files"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void loadWorkspaceDirectory(
                          workspaceListing?.path || "",
                        )
                      }
                      disabled={!localAgentInfo || workspaceEntriesLoading}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 disabled:opacity-50"
                    >
                      {workspaceEntriesLoading ? "Loading..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveWorkspaceFile()}
                      disabled={
                        !workspaceEditorFile ||
                        workspaceEditorDraft === workspaceEditorFile.content ||
                        workspaceSaving
                      }
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceSaving ? "Saving..." : "Save to PC"}
                    </button>
                  </div>
                </div>
                {buildDiagnostics.length > 0 && (
                  <div
                    className="border-b border-slate-800 bg-red-950/15 px-4 py-3"
                    aria-label="Build diagnostics"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-red-200">
                        Build diagnostics
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {buildDiagnostics.length} issue
                        {buildDiagnostics.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="max-h-48 space-y-1 overflow-auto">
                      {buildDiagnostics.map((diagnostic, index) => (
                        <button
                          type="button"
                          key={`${diagnostic.file}-${diagnostic.line}-${diagnostic.message}-${index}`}
                          onClick={() => void openBuildDiagnostic(diagnostic)}
                          disabled={!diagnostic.file}
                          title={
                            diagnostic.file
                              ? "Open this source file in the editor."
                              : "This error does not identify a source file."
                          }
                          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-red-400/10 disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase text-red-300">
                            {diagnostic.severity}
                          </span>
                          <span className="min-w-0 flex-1 text-xs leading-5 text-slate-200">
                            {diagnostic.file && (
                              <span className="mr-2 font-mono text-indigo-200">
                                {diagnostic.file}
                                {diagnostic.line ? `:${diagnostic.line}` : ""}
                                {diagnostic.column
                                  ? `:${diagnostic.column}`
                                  : ""}
                              </span>
                            )}
                            {diagnostic.message}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid min-h-[560px] lg:grid-cols-[minmax(240px,0.65fr)_minmax(0,1.65fr)]">
                  <div
                    id="workspace-explorer-list"
                    className="max-h-[650px] overflow-auto border-b border-slate-800 p-3 lg:border-b-0 lg:border-r"
                  >
                    {!localAgentInfo ? (
                      <p className="p-2 text-sm text-slate-500">
                        Connect the Local Agent to view your workspace.
                      </p>
                    ) : workspaceEntriesLoading && !workspaceListing ? (
                      <p className="p-2 text-sm text-slate-500">
                        Loading workspace files...
                      </p>
                    ) : !workspaceListing?.entries.length ? (
                      <p className="p-2 text-sm text-slate-500">
                        This folder is empty.
                      </p>
                    ) : (
                      <div className="space-y-1 font-mono text-xs">
                        {workspaceListing.entries.map((entry) => (
                          <button
                            type="button"
                            key={entry.path}
                            onClick={() =>
                              entry.type === "directory"
                                ? void browseWorkspaceDirectory(entry.path)
                                : void openWorkspaceFile(entry)
                            }
                            disabled={
                              workspaceEntriesLoading ||
                              (entry.type === "file" &&
                                entry.editable === false)
                            }
                            title={
                              entry.type === "file" && entry.editable === false
                                ? "Files larger than 1 MB are not editable in the browser."
                                : entry.path
                            }
                            className={`block w-full truncate rounded-md px-2 py-2 text-left ${
                              workspaceEditorFile?.path === entry.path
                                ? "bg-indigo-500/15 text-indigo-200"
                                : entry.editable === false
                                  ? "cursor-not-allowed text-slate-600"
                                  : "text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            <span
                              className="mr-2 text-slate-500"
                              aria-hidden="true"
                            >
                              {entry.type === "directory" ? "▸" : "·"}
                            </span>
                            {entry.name}
                            {entry.type === "file" && (
                              <span className="float-right text-slate-600">
                                {entry.size !== undefined
                                  ? `${Math.ceil(entry.size / 1024)} KB`
                                  : ""}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[560px] min-w-0 flex-col bg-[#080d17]">
                    {workspaceEditorFile ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="rounded bg-indigo-400/10 px-2 py-1 text-[10px] font-bold tracking-wide text-indigo-200">
                              {editorLanguage}
                            </span>
                            <span className="truncate font-mono text-xs text-slate-200">
                              {workspaceEditorFile.path}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 text-[11px] ${
                              workspaceEditorDraft !==
                              workspaceEditorFile.content
                                ? "text-amber-300"
                                : "text-slate-500"
                            }`}
                          >
                            {workspaceEditorDraft !==
                            workspaceEditorFile.content
                              ? "● Unsaved"
                              : "Saved"}
                          </span>
                        </div>
                        <div className="flex min-h-0 flex-1 overflow-hidden">
                          <div
                            ref={editorGutterRef}
                            aria-hidden="true"
                            className="w-14 shrink-0 overflow-hidden border-r border-slate-800/80 bg-[#070b12] py-4 text-right font-mono text-xs leading-6 text-slate-600"
                          >
                            {Array.from(
                              { length: editorLineCount },
                              (_, index) => {
                                const line = index + 1;
                                const hasIssue = editorFileDiagnostics.some(
                                  (diagnostic) => diagnostic.line === line,
                                );
                                return (
                                  <div
                                    key={line}
                                    className={`h-6 px-3 ${
                                      hasIssue
                                        ? "bg-red-400/10 text-red-300"
                                        : line === editorCursor.line
                                          ? "text-indigo-300"
                                          : ""
                                    }`}
                                  >
                                    {line}
                                  </div>
                                );
                              },
                            )}
                          </div>
                          <textarea
                            ref={workspaceEditorRef}
                            aria-label={`Edit ${workspaceEditorFile.path}`}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            wrap="off"
                            style={{ tabSize: 2 }}
                            value={workspaceEditorDraft}
                            onChange={(event) => {
                              setWorkspaceEditorDraft(event.target.value);
                              updateEditorCursor(event.target);
                            }}
                            onClick={(event) =>
                              updateEditorCursor(event.currentTarget)
                            }
                            onKeyUp={(event) =>
                              updateEditorCursor(event.currentTarget)
                            }
                            onScroll={(event) => {
                              if (editorGutterRef.current) {
                                editorGutterRef.current.scrollTop =
                                  event.currentTarget.scrollTop;
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Tab") return;
                              event.preventDefault();
                              const editor = event.currentTarget;
                              editor.setRangeText(
                                "  ",
                                editor.selectionStart,
                                editor.selectionEnd,
                                "end",
                              );
                              setWorkspaceEditorDraft(editor.value);
                              updateEditorCursor(editor);
                            }}
                            className="h-full min-h-[500px] min-w-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-slate-200 outline-none selection:bg-indigo-500/30 focus:ring-1 focus:ring-inset focus:ring-indigo-500/50"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[10px] text-slate-500">
                          <span>Local file · UTF-8</span>
                          <span>
                            Ln {editorCursor.line}, Col {editorCursor.column}
                            {editorFileDiagnostics.length > 0 &&
                              ` · ${editorFileDiagnostics.length} issue${editorFileDiagnostics.length === 1 ? "" : "s"}`}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-500">
                        <div>
                          <div className="mb-2 text-lg text-slate-400">
                            No file open
                          </div>
                          Choose a text file from Explorer, or run a build to
                          inspect and open source diagnostics here.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-800 px-4 py-3">
                  <p className="text-xs leading-5 text-slate-500">
                    Build diagnostics can open their source file at the reported
                    line. Save writes directly to the selected local file; use{" "}
                    <span className="text-emerald-300">Build edited files</span>{" "}
                    to compile local changes without syncing over them.
                    Hidden/secret files, dependency folders, symlinks, binary
                    files, and files over 1 MB are not editable here. Review
                    your changes before saving.
                  </p>
                </div>
              </section>

              {/* Findings are tied to the code artifact reviewed by the latest run. */}
              {latestReview && (
                <section
                  className="mt-5 glass rounded-2xl p-4"
                  aria-label="Latest AI code review"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      Latest AI code review
                    </div>
                    <span className="text-xs text-slate-500">
                      {reviewFindings.length} finding
                      {reviewFindings.length === 1 ? "" : "s"} · saved
                    </span>
                  </div>
                  {typeof reviewContent?.summary === "string" && (
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {reviewContent.summary}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {reviewFindings.length ? (
                      reviewFindings.map((finding: any, index: number) => (
                        <details
                          key={`${finding.filePath}-${finding.title}-${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-950/60"
                        >
                          <summary className="cursor-pointer px-3 py-2.5 text-sm text-slate-200">
                            <span
                              className={`mr-2 text-xs font-semibold ${finding.severity === "CRITICAL" || finding.severity === "HIGH" ? "text-red-300" : finding.severity === "MEDIUM" ? "text-amber-300" : "text-slate-400"}`}
                            >
                              {finding.severity}
                            </span>
                            {finding.title}
                            <span className="ml-2 text-xs text-slate-500">
                              {finding.filePath}
                            </span>
                          </summary>
                          <div className="space-y-3 border-t border-slate-800 p-3 text-sm">
                            <p className="leading-6 text-slate-400">
                              {finding.description}
                            </p>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                                Suggested fix
                              </p>
                              <p className="leading-6 text-slate-300">
                                {finding.suggestedFix}
                              </p>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <p className="rounded-lg bg-slate-950/60 p-3 text-sm text-emerald-300">
                        No actionable findings.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* One prompt supports initial generation and later modification requests. */}
              <div className="mt-5 glass rounded-2xl p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    AI Project Builder
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    AI provider
                    <select
                      value={selectedAIProvider}
                      disabled={isBusy}
                      onChange={(event) =>
                        setSelectedAIProvider(event.target.value as AIProvider)
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-50"
                    >
                      {aiProviderConfigs.map((provider) => (
                        <option
                          key={provider.provider}
                          value={provider.provider}
                        >
                          {provider.label}
                          {provider.configured ? "" : " · setup required"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details
                  open={providerSettingsExpanded}
                  onToggle={(event) =>
                    setProviderSettingsExpanded(event.currentTarget.open)
                  }
                  className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">
                    AI provider settings
                  </summary>
                  <div className="space-y-3 border-t border-slate-800 p-4">
                    <p className="text-xs leading-5 text-slate-500">
                      Provider settings and keys apply only to your account.
                      Keys are encrypted before storage and never returned to
                      the browser. OpenAI-compatible services (including
                      compatible endpoints from other AI providers) can use
                      Custom.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-slate-400">
                        Provider to configure
                        <select
                          value={providerSettingsProvider}
                          onChange={(event) =>
                            selectProviderSettings(
                              event.target.value as AIProvider,
                            )
                          }
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                        >
                          <option value="OPENROUTER">OpenRouter</option>
                          <option value="OPENAI">OpenAI</option>
                          <option value="CUSTOM">
                            Custom OpenAI-compatible
                          </option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-400">
                        Model
                        <input
                          value={providerModelDraft}
                          onChange={(event) =>
                            setProviderModelDraft(event.target.value)
                          }
                          maxLength={200}
                          placeholder={
                            providerSettingsProvider === "OPENROUTER"
                              ? "openrouter/free"
                              : providerSettingsProvider === "OPENAI"
                                ? "gpt-4o-mini"
                                : "Model ID from your provider"
                          }
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                    {providerSettingsProvider === "CUSTOM" && (
                      <label className="block text-xs text-slate-400">
                        Public HTTPS API base URL
                        <input
                          type="url"
                          value={providerBaseUrlDraft}
                          onChange={(event) =>
                            setProviderBaseUrlDraft(event.target.value)
                          }
                          maxLength={2048}
                          placeholder="https://api.example.com/v1"
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                        />
                        <span className="mt-1 block text-[11px] text-slate-500">
                          Must support the OpenAI-compatible /chat/completions
                          API. Private/local endpoints are not allowed.
                        </span>
                      </label>
                    )}
                    <label className="block text-xs text-slate-400">
                      API key
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={providerApiKeyDraft}
                        onChange={(event) =>
                          setProviderApiKeyDraft(event.target.value)
                        }
                        maxLength={4096}
                        placeholder={
                          aiProviderConfigs.find(
                            (provider) =>
                              provider.provider === providerSettingsProvider,
                          )?.hasUserKey
                            ? "Saved key is hidden; enter a new key to replace it"
                            : "Enter your provider API key"
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveAIProviderSettings()}
                        disabled={providerSaving}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        {providerSaving ? "Saving..." : "Save provider"}
                      </button>
                      {aiProviderConfigs.find(
                        (provider) =>
                          provider.provider === providerSettingsProvider,
                      )?.hasUserKey && (
                        <button
                          type="button"
                          onClick={() => void removeAIProviderSettings()}
                          disabled={providerSaving}
                          className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:border-red-400 disabled:opacity-50"
                        >
                          Remove saved key
                        </button>
                      )}
                      <span className="text-[11px] text-slate-500">
                        {aiProviderConfigs.find(
                          (provider) =>
                            provider.provider === providerSettingsProvider,
                        )?.configured
                          ? "Configured"
                          : "Not configured yet"}
                      </span>
                    </div>
                  </div>
                </details>
                {/* All generation/modification requests run from the AI Assistant
                    chat on the right; no separate prompt or Generate button here. */}
                {generatedFiles.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      disabled={downloadingProjectZip}
                      onClick={() => void downloadProjectZip()}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-emerald-200 disabled:cursor-wait disabled:opacity-50"
                      title="Download all saved project files as a ZIP. No Local Agent or pairing token required."
                    >
                      {downloadingProjectZip
                        ? "Preparing ZIP..."
                        : "Download ZIP"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || !generatedFiles.length}
                      onClick={() => void saveGeneratedFilesToLocalPc()}
                      className="rounded-lg border border-indigo-500/50 px-4 py-2 text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Save the generated files directly into a folder on your PC. No Local Agent required."
                    >
                      Save to my PC
                    </button>
                  </div>
                )}
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <p className="flex-1 text-xs leading-5 text-slate-400">
                      DevForge will start the installed Local Agent and pair
                      automatically. The agent stays on this PC and keeps
                      project files local.
                    </p>
                    <button
                      onClick={() => void connectLocalAgent()}
                      disabled={localAgentConnecting}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-indigo-400"
                    >
                      {localAgentConnecting
                        ? "Starting and connecting..."
                        : localAgentInfo
                          ? "Reconnect agent"
                          : "Connect agent"}
                    </button>
                    {localAgentInfo && (
                      <button
                        onClick={() => void disconnectLocalAgent()}
                        className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-200 hover:border-red-400"
                      >
                        Disconnect agent
                      </button>
                    )}
                  </div>
                  {localAgentError && (
                    <p className="mt-3 text-xs text-amber-300">
                      {localAgentError}{" "}
                      <a
                        href="/guide"
                        className="underline underline-offset-2 hover:text-amber-200"
                      >
                        Open setup guide
                      </a>
                    </p>
                  )}
                  {localAgentInfo && (
                    <p className="mt-3 text-xs text-emerald-300">
                      Connected to {localAgentInfo.machine} (
                      {localAgentInfo.platform}). Workspace:{" "}
                      {localAgentInfo.workspaceRoot}
                    </p>
                  )}
                  {localAgentInfo && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs text-slate-400">
                        Import a folder from this workspace
                        <select
                          value={localImportPath}
                          onChange={(event) =>
                            setLocalImportPath(event.target.value)
                          }
                          disabled={
                            !workspaceProjects.length || importingProject
                          }
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                        >
                          {!workspaceProjects.length && (
                            <option value="">No project folders found</option>
                          )}
                          {workspaceProjects.map((project) => (
                            <option key={project.path} value={project.path}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => void importLocalProject()}
                        disabled={!localImportPath || importingProject}
                        className="rounded-lg border border-indigo-500/50 px-4 py-2 text-sm text-indigo-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importingProject
                          ? "Importing..."
                          : "Import local project"}
                      </button>
                    </div>
                  )}
                  {/* Git operations run on the PC; the server stores only remote metadata. */}
                  <section
                    className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                    aria-label="GitHub synchronization"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">
                          GitHub synchronization
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Connect a repository, clone or pull it to this PC,
                          then commit and push local changes.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {selected.githubOwner && selected.githubRepository
                          ? `${selected.gitSyncStatus || "CONNECTED"} · ${selected.githubOwner}/${selected.githubRepository}`
                          : "No repository connected"}
                      </span>
                      {selected.githubOwner && selected.githubRepository && (
                        <button
                          type="button"
                          onClick={() => void disconnectGitHubRepository()}
                          disabled={Boolean(githubBusy)}
                          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:border-red-400 disabled:cursor-wait disabled:opacity-50"
                        >
                          {githubBusy === "disconnect"
                            ? "Disconnecting..."
                            : "Disconnect repository"}
                        </button>
                      )}
                    </div>
                    {selected.githubOwner && selected.githubRepository ? (
                      <>
                        <p className="mt-3 text-xs text-slate-400">
                          Branch:{" "}
                          <span className="text-slate-200">
                            {selected.githubBranch}
                          </span>
                          {selected.lastSyncedAt && (
                            <>
                              {" "}
                              · Last synced:{" "}
                              {new Date(selected.lastSyncedAt).toLocaleString()}
                            </>
                          )}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <label className="text-xs text-slate-400">
                            Local workspace folder
                            <input
                              value={
                                githubLocalPath ||
                                selected.localPath ||
                                `projects/${selected.id}-github`
                              }
                              onChange={(event) =>
                                setGitHubLocalPath(event.target.value)
                              }
                              disabled={!localAgentInfo || Boolean(githubBusy)}
                              placeholder={`projects/${selected.id}-github`}
                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Commit message
                            <input
                              value={githubCommitMessage}
                              onChange={(event) =>
                                setGitHubCommitMessage(event.target.value)
                              }
                              disabled={Boolean(githubBusy)}
                              placeholder={`Sync ${selected.name} from DevForge`}
                              maxLength={200}
                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void cloneGitHubRepository()}
                            disabled={!localAgentInfo || Boolean(githubBusy)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {githubBusy === "clone"
                              ? "Cloning..."
                              : "Clone to PC"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void pullGitHubRepository()}
                            disabled={!localAgentInfo || Boolean(githubBusy)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {githubBusy === "pull"
                              ? "Pulling..."
                              : "Pull latest"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void pushGitHubRepository()}
                            disabled={!localAgentInfo || Boolean(githubBusy)}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {githubBusy === "push"
                              ? "Pushing..."
                              : "Commit & push"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void pushGitHubRepository(true)}
                            disabled={!localAgentInfo || Boolean(githubBusy)}
                            className="rounded-lg border border-indigo-500/50 px-3 py-2 text-xs text-indigo-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Initialize Git in this folder or attach the connected GitHub repository as its origin, then commit and push."
                          >
                            {githubBusy === "push"
                              ? "Pushing..."
                              : "Initialize & push"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                          <label className="flex-1 text-xs text-slate-400">
                            Existing repository with write access
                            <select
                              value={githubRepositorySelection}
                              onChange={(event) =>
                                setGitHubRepositorySelection(event.target.value)
                              }
                              disabled={Boolean(githubBusy)}
                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                            >
                              {!githubRepositories.length && (
                                <option value="">
                                  No writable repositories found
                                </option>
                              )}
                              {githubRepositories.map((repository) => (
                                <option
                                  key={repository.id}
                                  value={repository.fullName}
                                >
                                  {repository.fullName}
                                  {repository.private ? " (private)" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => void refreshGitHubRepositories()}
                            disabled={Boolean(githubBusy)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:opacity-50"
                          >
                            {githubBusy === "repositories"
                              ? "Loading..."
                              : "Refresh"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void connectSelectedGitHubRepository()
                            }
                            disabled={
                              !githubRepositorySelection || Boolean(githubBusy)
                            }
                            className="rounded-lg border border-indigo-500/50 px-3 py-2 text-xs text-indigo-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {githubBusy === "connect"
                              ? "Connecting..."
                              : "Connect existing"}
                          </button>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-end">
                          <label className="flex-1 text-xs text-slate-400">
                            Create a new repository
                            <input
                              value={githubNewRepository}
                              onChange={(event) =>
                                setGitHubNewRepository(event.target.value)
                              }
                              disabled={Boolean(githubBusy)}
                              placeholder="repository-name"
                              maxLength={100}
                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Visibility
                            <select
                              value={
                                githubNewRepositoryPrivate
                                  ? "private"
                                  : "public"
                              }
                              onChange={(event) =>
                                setGitHubNewRepositoryPrivate(
                                  event.target.value === "private",
                                )
                              }
                              disabled={Boolean(githubBusy)}
                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                            >
                              <option value="private">Private</option>
                              <option value="public">Public</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => void createGitHubRepository()}
                            disabled={
                              !githubNewRepository.trim() || Boolean(githubBusy)
                            }
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {githubBusy === "create"
                              ? "Creating..."
                              : `Create ${githubNewRepositoryPrivate ? "private" : "public"} repo`}
                          </button>
                        </div>
                      </>
                    )}
                    {!localAgentInfo && (
                      <p className="mt-3 text-xs leading-5 text-amber-300">
                        Connect the Local Agent to clone, pull, or push. Install
                        Git on this PC and sign in through its Git Credential
                        Manager for private repository access; the GitHub token
                        is never sent to the agent.
                      </p>
                    )}
                  </section>
                  {!localAgentInfo && (
                    <p className="mt-3 text-xs leading-5 text-amber-300">
                      Select <strong>Connect agent</strong> to start the
                      installed agent and pair automatically, or ask the AI
                      Assistant in chat to connect it for you. For first-time
                      setup, follow the{" "}
                      <a
                        href="/guide"
                        className="underline underline-offset-2 hover:text-amber-200"
                      >
                        Local Agent install guide
                      </a>
                      .
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Generated files are saved in your DevForge account first.
                    Use <strong>Sync files to PC</strong> to copy them into{" "}
                    <code>projects/{selected.id}</code> with the Local Agent, or
                    select <strong>Download ZIP</strong> to save a copy without
                    connecting the agent. Build/Test require the connected Local
                    Agent and run scripts on your PC. Only run projects you
                    trust.
                  </p>
                </div>
                {localConsoleOutput && (
                  <section
                    className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#05070b]"
                    aria-label="Local build and test console"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                        <span className="font-mono text-indigo-300">&gt;_</span>
                        Local terminal output
                      </div>
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          localConsoleStatus === "running"
                            ? "text-amber-300"
                            : localConsoleStatus === "success"
                              ? "text-emerald-300"
                              : localConsoleStatus === "failed"
                                ? "text-red-300"
                                : "text-slate-400"
                        }`}
                      >
                        {localAction
                          ? `${localAction} running`
                          : localConsoleStatus}
                      </span>
                    </div>
                    <pre
                      ref={localConsoleRef}
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                      className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-slate-200"
                    >
                      {localConsoleOutput}
                    </pre>
                  </section>
                )}
                {localResult && (
                  <div className="mt-4 space-y-3">
                    {localResult.stages.map((stage, index) => (
                      <details
                        key={`${stage.name}-${index}`}
                        open={stage.code !== 0}
                        className="rounded-lg border border-slate-800 bg-slate-950/70"
                      >
                        <summary
                          className={`cursor-pointer px-3 py-2.5 text-sm ${stage.code === 0 ? "text-emerald-300" : "text-red-300"}`}
                        >
                          {stage.name} · {stage.command} · exit{" "}
                          {stage.code ?? "unknown"}
                        </summary>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-slate-800 p-3 text-xs leading-5 text-slate-300">
                          {[
                            stage.stdout,
                            stage.stderr && `STDERR:\n${stage.stderr}`,
                            stage.truncated && "[Output truncated at 128 KB]",
                          ]
                            .filter(Boolean)
                            .join("\n\n") || "No command output."}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
                {isBusy && (
                  <p className="mt-3 text-sm text-amber-300">
                    {activeOperation === "review"
                      ? "AI review is in progress. You can keep this page open; please avoid submitting another operation for this project."
                      : "Generation is in progress. You can keep this page open; please avoid submitting another operation for this project."}
                  </p>
                )}
                {runId && (
                  <p className="mt-2 text-xs text-slate-500">
                    Project run: {runId}
                  </p>
                )}
              </div>
            </>
          )}
        </main>

        {/* Project Q&A is separate from file modification and run activity. */}
        <aside className="border-l border-slate-800 flex min-h-0 flex-col">
          <div className="border-b border-slate-800 p-4">
            <div className="font-semibold">AI Assistant</div>
            <p className="mt-1 text-xs text-slate-500">
              All processes run from here: “generate a todo app”, “modify
              the header”, “review my code”, “build”, “test”, or
              “save files to my PC”.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
            {!chatMessages.length && (
              <p className="text-slate-500">
                {selected
                  ? "Tell me what to do — generate, modify, review, build, test, or save to your PC. I'll run the whole workflow and report back."
                  : "Select a project to start chatting."}
              </p>
            )}
            {chatMessages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className={`rounded-xl p-3 ${
                  message.role === "user"
                    ? "ml-5 bg-indigo-500/15 text-indigo-100"
                    : "mr-2 border border-slate-800 bg-slate-900 text-slate-200"
                }`}
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "DevForge AI"}
                </div>
                <p className="whitespace-pre-wrap leading-6">
                  {message.content}
                </p>
              </div>
            ))}
            {chatBusy && (
              <p className="text-xs text-amber-300">
                Thinking about your question...
              </p>
            )}
            {lastFailedChatQuestion && !chatBusy && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
                <p>The last request failed.</p>
                <button
                  type="button"
                  onClick={() => {
                    const question = lastFailedChatQuestion;
                    setLastFailedChatQuestion(null);
                    setChatInput(question);
                    window.setTimeout(() => void sendChatMessage(), 0);
                  }}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                >
                  Retry request
                </button>
              </div>
            )}
          </div>
          <form
            className="border-t border-slate-800 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendChatMessage();
            }}
          >
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void sendChatMessage();
                }
              }}
              disabled={!selected || chatBusy}
              maxLength={4000}
              rows={3}
              placeholder={
                selected
                  ? "e.g. generate a portfolio site, review the code, build, or save files to my PC… (Ctrl+Enter to send)"
                  : "Select a project first"
              }
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-600">
                {chatInput.length}/4000
              </span>
              <button
                type="submit"
                disabled={!selected || !chatInput.trim() || chatBusy}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chatBusy ? "Answering..." : "Ask"}
              </button>
            </div>
          </form>
          {logs.length > 0 && (
            <details className="max-h-36 overflow-auto border-t border-slate-800 px-3 py-2">
              <summary className="cursor-pointer text-xs text-slate-500">
                Recent activity ({logs.length})
              </summary>
              <div className="mt-2 space-y-2 text-xs text-slate-400">
                {logs.slice(-20).map((entry, index) => (
                  <p key={`${index}-${entry}`}>{entry}</p>
                ))}
              </div>
            </details>
          )}
        </aside>
      </div>

      <footer className="min-h-9 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>IDE · Terminal · Build · Test · Review · Git · GitHub</span>
        <span>
          © {new Date().getFullYear()} Aung Ko Lin. All rights reserved.
        </span>
      </footer>
      {/* All confirmation, status, warning, and error messages use this modal. */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <section
            aria-labelledby="message-modal-title"
            aria-describedby="message-modal-description"
            aria-modal="true"
            role={modal.cancelLabel ? "alertdialog" : "dialog"}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeModal(false);
              }
            }}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold ${
                  modal.kind === "error"
                    ? "bg-red-400/10 text-red-300"
                    : modal.kind === "warning"
                      ? "bg-amber-400/10 text-amber-300"
                      : modal.kind === "success"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-indigo-400/10 text-indigo-300"
                }`}
              >
                {modal.kind === "error"
                  ? "!"
                  : modal.kind === "warning"
                    ? "⚠"
                    : modal.kind === "success"
                      ? "✓"
                      : "i"}
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="message-modal-title"
                  className="text-lg font-semibold text-white"
                >
                  {modal.title}
                </h2>
                <p
                  id="message-modal-description"
                  className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300"
                >
                  {modal.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              {modal.cancelLabel && (
                <button
                  type="button"
                  onClick={() => closeModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  {modal.cancelLabel}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => closeModal(Boolean(modal.confirmLabel))}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                  modal.kind === "error"
                    ? "bg-red-700 hover:bg-red-600"
                    : modal.kind === "warning"
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {modal.confirmLabel || "Close"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * /connect page opened by the VS Code extension. It shows the pairing code,
 * signs the user in with GitHub if needed, and approves the pairing so the
 * extension receives its session automatically — no cookie copying.
 */
function ConnectExtension({
  user,
  loading,
}: {
  user: User | null;
  loading: boolean;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "approving" | "approved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The code arrives in the query string: /connect?code=...
    const params = new URLSearchParams(window.location.search);
    const value = params.get("code");
    if (value) setCode(value);
    else
      setError(
        "No pairing code was provided. Start sign-in from VS Code again.",
      );
  }, []);

  async function approve() {
    if (!code || status === "approving") return;
    setStatus("approving");
    setError(null);
    try {
      await api.approvePairing(code);
      setStatus("approved");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Pairing failed");
    }
  }

  // Auto-approve as soon as the user is signed in and a code is present.
  useEffect(() => {
    if (user && code && status === "idle") void approve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code, status]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">
        <div
          className="flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <span className="api-loading-spinner" aria-hidden="true" />
          <span>Connecting to VS Code…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">
            Connect VS Code to DevForge
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with GitHub first. DevForge will then connect VS Code
            automatically.
          </p>
          <button
            type="button"
            onClick={() => api.login()}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500"
          >
            Sign in with GitHub
          </button>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 px-4 text-slate-200">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Connect VS Code to DevForge</h1>
        {status === "approved" ? (
          <>
            <p className="text-sm text-emerald-400">
              VS Code is connected. You can close this tab and return to VS
              Code.
            </p>
          </>
        ) : status === "error" ? (
          <>
            <p className="text-sm text-rose-400">{error}</p>
            <button
              type="button"
              onClick={approve}
              className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              Approving connection for VS Code…
            </p>
            <div
              className="flex items-center justify-center gap-3"
              role="status"
            >
              <span className="api-loading-spinner" aria-hidden="true" />
              <span>Please wait…</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Admin page: manage every registered user of the web app and VS Code
 * extension. Only ADMIN-role accounts can load it; the API enforces that too.
 */
function AdminPage({ user }: { user: User }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [actingUserId, setActingUserId] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const response = await api.adminUsers();
      setUsers(response.users);
      setStats(response.stats);
      setActingUserId(response.actingUserId);
      setErrorText(null);
    } catch (cause) {
      setErrorText(
        cause instanceof Error ? cause.message : "Could not load users",
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(
    id: string,
    patch: { role?: "USER" | "ADMIN"; isBlocked?: boolean },
  ) {
    setBusyId(id);
    try {
      await api.adminUpdateUser(id, patch);
      await load();
    } catch (cause) {
      setErrorText(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(user: AdminUser) {
    const confirmed = window.confirm(
      `Delete ${user.githubUsername ?? user.githubName ?? user.id}? This permanently removes their projects, artifacts, sessions and agents.`,
    );
    if (!confirmed) return;
    setBusyId(user.id);
    try {
      await api.adminDeleteUser(user.id);
      await load();
    } catch (cause) {
      setErrorText(cause instanceof Error ? cause.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = users.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.githubUsername, item.githubName, item.email, item.role].some(
      (value) => (value ?? "").toLowerCase().includes(q),
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">DevForge AI — Admin</h1>
          <p className="text-xs text-slate-400">
            Manage users of the web app and the VS Code extension.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            onClick={() => (window.location.href = "/")}
          >
            Back to workspace
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        {errorText && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-2 text-sm text-red-200"
          >
            {errorText}
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Users" value={stats.users} />
            <StatCard label="Projects" value={stats.projects} />
            <StatCard label="AI requests" value={stats.aiRequests} />
            <StatCard label="Active sessions" value={stats.activeSessions} />
          </div>
        )}
        <input
          className="mb-4 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Search by username, name, email or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Projects</th>
                <th className="px-3 py-2">Last seen</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const self = item.id === actingUserId;
                const busy = busyId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-800 align-middle"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {item.avatarUrl && (
                          <img
                            src={item.avatarUrl}
                            alt=""
                            className="h-7 w-7 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium">
                            {item.githubUsername
                              ? `@${item.githubUsername}`
                              : (item.githubName ?? item.id)}
                            {self && (
                              <span className="ml-2 text-xs text-slate-400">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.email ?? "no email"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          item.role === "ADMIN"
                            ? "rounded bg-indigo-900/70 px-2 py-0.5 text-xs"
                            : "rounded bg-slate-800 px-2 py-0.5 text-xs"
                        }
                      >
                        {item.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          item.isBlocked ? "text-red-300" : "text-emerald-300"
                        }
                      >
                        {item.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.projectCount}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {item.lastSeenAt
                        ? new Date(item.lastSeenAt).toLocaleString()
                        : "never"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy || self}
                          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-40"
                          onClick={() =>
                            update(item.id, {
                              role: item.role === "ADMIN" ? "USER" : "ADMIN",
                            })
                          }
                        >
                          {item.role === "ADMIN"
                            ? "Revoke admin"
                            : "Make admin"}
                        </button>
                        <button
                          disabled={busy || self}
                          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-40"
                          onClick={() =>
                            update(item.id, { isBlocked: !item.isBlocked })
                          }
                        >
                          {item.isBlocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          disabled={busy || self}
                          className="rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-40"
                          onClick={() => remove(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No users match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

// Resolve the current session before rendering either the login or project UI.
function Root() {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  const isPublicGuide = pathname === "/guide";
  const isConnectPage = pathname === "/connect";
  const isAdminPage = pathname === "/admin";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (isPublicGuide) return;
    // Resolve authentication once; the router sends expired sessions back to login.
    // A failed session lookup is treated as signed out, while loading always completes.
    api
      .me()
      .then((response) => setUser(response.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPublicGuide]);
  if (isPublicGuide) return <UserGuide />;
  if (isConnectPage) return <ConnectExtension user={user} loading={loading} />;
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">
        <div
          className="flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <span className="api-loading-spinner" aria-hidden="true" />
          <span>Loading DevForge...</span>
        </div>
      </div>
    );
  }
  if (user) {
    // Non-admins visiting /admin are redirected to the workspace; the admin
    // API itself also rejects non-admin roles with 403.
    if (isAdminPage)
      return (user as User).role === "ADMIN" ? (
        <AdminPage user={user} />
      ) : (
        <App user={user} />
      );
    return <App user={user} />;
  }
  return <Login />;
}

createRoot(document.getElementById("root")!).render(<Root />);
