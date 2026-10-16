import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  getApiActivitySnapshot,
  subscribeToApiActivity,
  type ChatMessage,
  type LocalProjectResult,
  type LocalWorkspaceEntry,
  type LocalWorkspaceFile,
  type LocalWorkspaceListing,
  type GitHubRepository,
  type User,
} from "./api";
import { useProjectGeneration } from "./hooks/useProjectGeneration";

// Text-only brand lockup shared by the landing page and dashboard headers.
function BrandWordmark() {
  return (
    <span className="brand-wordmark">
      <span className="brand-wordmark-name">DevForge</span>
      <span className="brand-wordmark-ai">AI</span>
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
        "Start the Local Agent on your PC, enter its pairing token in the signed-in workspace, and connect. Sync generated files, then open <workspace>\\projects\\<project-id> in VS Code (File → Open Folder, or run code \"<folder-path>\" in PowerShell). You can also open an imported project folder. DevForge does not currently provide a dedicated VS Code extension.",
    },
    {
      number: "04",
      title: "Build and test safely",
      description:
        "DevForge's Build locally and Test locally actions ask before running scripts, but first copy the saved generated files onto the PC and may overwrite matching local edits. After editing in VS Code, run checks in its terminal if you need to preserve those edits. Local edits are not automatically saved back to DevForge.",
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
        "Generate code with OpenRouter and save the plans and files as PostgreSQL-backed project artifacts.",
    },
    {
      number: "03",
      title: "Develop locally",
      description:
        "Connect a workspace-restricted local agent to import projects and run build or test commands on your PC.",
    },
  ];

  const roadmap = [
    // Display shipped and planned workflow areas in their numbered roadmap order.
    ["01", "Generation you can verify", "Available"],
    ["02", "AI code review", "Available"],
    ["03", "Local project import, build and test", "Available"],
    ["04", "GitHub synchronization", "Available"],
    ["05", "More AI providers", "Planned"],
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
        <div className="mt-9 grid gap-4 md:grid-cols-3">
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
  const [modal, setModal] = useState<ModalState | null>(null);
  const modalResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [selected, setSelected] = useState<any>();
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  // Keep the pairing secret in this browser only; it is sent directly to loopback.
  const [localAgentToken, setLocalAgentToken] = useState(
    () => window.localStorage.getItem("devforge-local-agent-token") || "",
  );
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
  const [syncingGeneratedFiles, setSyncingGeneratedFiles] = useState(false);
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

  useEffect(() => {
    load().catch((cause) => {
      const message =
        cause instanceof Error ? cause.message : "Could not load projects.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      showModal("error", "Could not load projects", message);
    });
    void refreshGitHubRepositories();
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
    setLogs((current) => [...current, `Starting AI ${operationLabel}...`]);
    try {
      const completedRun = await runGeneration(
        selected.id,
        prompt,
        "OPENROUTER",
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
    const completedRun = await runReview(selected.id);
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
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error ? cause.message : "Could not open this file.",
      );
    }
  }

  // Save editor content only if the on-disk file has not changed since it was read.
  async function saveWorkspaceFile() {
    if (!workspaceEditorFile || workspaceSaving) return;
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
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error ? cause.message : "Could not save this file.",
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  // Verify the pairing token, persist it locally, then load the agent workspace.
  async function connectLocalAgent() {
    const token = localAgentToken.trim();
    if (!token) {
      setLocalAgentError(
        "Enter the pairing token printed by your local agent.",
      );
      return;
    }

    setLocalAgentError(null);
    try {
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
      setLocalAgentError(
        cause instanceof Error
          ? cause.message
          : "Could not connect to the local agent.",
      );
    }
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

  // Sync saved files to the PC and explicitly confirm before executing project scripts.
  async function runLocalAction(action: "build" | "test") {
    if (!selected || !localAgentInfo || !generatedFiles.length || localAction) {
      return;
    }

    const label = action === "build" ? "build" : "test";
    if (
      !(await confirmModal(
        `Run local ${label}`,
        `This will copy the generated files to your PC (overwriting matching files in this DevForge project folder) and run the project's ${label} scripts locally. Project scripts may execute arbitrary code. Continue only if you trust this generated project.`,
        `Run ${label}`,
      ))
    ) {
      return;
    }

    setLocalAction(action);
    setLocalResult(null);
    const localPath = `projects/${selected.id}`;

    try {
      const synced = await api.localAgent.syncProject(
        localAgentToken,
        localPath,
        generatedFiles,
      );
      setLogs((current) => [
        ...current,
        `Copied ${synced.files} generated files to ${synced.path} on ${localAgentInfo.machine}.`,
      ]);

      const response = await api.localAgent.runProject(
        localAgentToken,
        action,
        synced.path,
      );
      setLocalResult(response.result);
      for (const stage of response.result.stages) {
        const state = stage.code === 0 ? "passed" : "failed";
        setLogs((current) => [
          ...current,
          `${stage.name} ${state} (${stage.command}, exit ${stage.code ?? "unknown"}).`,
        ]);
      }
      if (!response.result.stages.length) {
        setLogs((current) => [
          ...current,
          `The local agent did not run a ${label} command.`,
        ]);
      }
      if (!response.result.success) {
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

  // Send the recent conversation to the assistant without modifying project files.
  async function sendChatMessage() {
    const question = chatInput.trim();
    if (!selected || !question || chatBusy) return;

    const nextMessages: ChatMessage[] = [
      ...chatMessages.slice(-11),
      { role: "user", content: question },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    try {
      const response = await api.chat(selected.id, nextMessages);
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: response.answer },
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not get an AI response.";
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: `Sorry, I couldn't answer: ${message}` },
      ]);
      showModal("error", "Could not get an AI response", message);
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
  const planArtifacts = artifacts.filter(
    (artifact: any) => artifact.type !== "CODE" && artifact.type !== "REVIEW",
  );
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
      <header className="h-14 border-b border-slate-800 px-5 flex items-center justify-between">
        <BrandWordmark />
        <div className="flex gap-4 items-center text-sm">
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
      {activeApiRequests > 0 && (
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
                  <h2 className="text-2xl font-bold">{selected.name}</h2>
                  <p className="text-slate-400 mt-1">{selected.description}</p>
                </div>
                <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs">
                  {selected.status}
                </span>
              </div>

              <div className="mt-6 glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 font-semibold">
                  Explorer
                </div>
                <div className="p-4 font-mono text-sm">
                  {generatedFiles.length ? (
                    generatedFiles.map((file: any, index: number) => (
                      <div
                        key={file.path || index}
                        className="py-1 text-slate-300"
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
                aria-label="Local workspace browser"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                  <div>
                    <h3 className="font-semibold">Local workspace files</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {workspaceListing
                        ? `${localAgentInfo?.workspaceRoot}${workspaceListing.path ? `\\${workspaceListing.path.replaceAll("/", "\\")}` : ""}`
                        : "Connect the Local Agent to browse files on your PC."}
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
                <div className="grid min-h-[360px] lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                  <div className="max-h-[480px] overflow-auto border-b border-slate-800 p-3 lg:border-b-0 lg:border-r">
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
                  <div className="flex min-h-[360px] flex-col">
                    {workspaceEditorFile ? (
                      <>
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2 text-xs">
                          <span className="truncate font-mono text-slate-300">
                            {workspaceEditorFile.path}
                          </span>
                          {workspaceEditorDraft !==
                            workspaceEditorFile.content && (
                            <span className="shrink-0 text-amber-300">
                              Unsaved changes
                            </span>
                          )}
                        </div>
                        <textarea
                          aria-label={`Edit ${workspaceEditorFile.path}`}
                          spellCheck={false}
                          value={workspaceEditorDraft}
                          onChange={(event) =>
                            setWorkspaceEditorDraft(event.target.value)
                          }
                          className="min-h-[320px] flex-1 resize-y bg-slate-950/70 p-4 font-mono text-xs leading-5 text-slate-200 outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500"
                        />
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-500">
                        Choose a text file to view or edit it on your PC.
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-800 px-4 py-3">
                  <p className="text-xs leading-5 text-slate-500">
                    Saving writes directly to the selected local file.
                    Hidden/secret files, dependency folders, symlinks, binary
                    files, and files over 1 MB are not editable here. Review
                    your changes before saving.
                  </p>
                </div>
              </section>

              {planArtifacts.length > 0 && (
                <div className="mt-5 glass rounded-2xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Saved project artifacts
                    </div>
                    <span className="text-xs text-slate-500">
                      Stored in PostgreSQL
                    </span>
                  </div>
                  <div className="space-y-2">
                    {planArtifacts.map((artifact: any) => (
                      <details
                        key={artifact.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/60"
                      >
                        <summary className="cursor-pointer px-3 py-2.5 text-sm text-slate-300">
                          {artifact.name}
                        </summary>
                        <pre className="max-h-72 overflow-auto border-t border-slate-800 p-3 text-xs leading-5 text-slate-400">
                          {JSON.stringify(artifact.content, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              )}

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
                <div className="text-sm font-semibold mb-3">
                  AI Project Builder
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={isBusy}
                  className="w-full h-36 rounded-xl bg-slate-950 border border-slate-800 p-3 outline-none focus:border-indigo-500 disabled:opacity-60"
                  placeholder={
                    generatedFiles.length
                      ? "Describe the software you want to build, or enter a modification request..."
                      : "Describe the software you want to build..."
                  }
                />
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={isBusy}
                    onClick={() => void generate()}
                    className="bg-indigo-600 disabled:opacity-50 rounded-lg px-4 py-2"
                  >
                    {activeOperation === "generate" &&
                    generationStatus === "STARTING"
                      ? "Starting..."
                      : activeOperation === "generate" &&
                          generationStatus === "RUNNING"
                        ? "Generating..."
                        : "Generate"}
                  </button>
                  {generatedFiles.length > 0 && (
                    <button
                      type="button"
                      disabled={isBusy || !prompt.trim()}
                      onClick={() => void generate("modify")}
                      className="rounded-lg border border-indigo-500/50 px-4 py-2 text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeOperation === "modify" &&
                      generationStatus === "STARTING"
                        ? "Starting..."
                        : activeOperation === "modify" &&
                            generationStatus === "RUNNING"
                          ? "Applying changes..."
                          : "Request modification"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      !localAgentInfo ||
                      !generatedFiles.length ||
                      syncingGeneratedFiles ||
                      Boolean(localAction)
                    }
                    onClick={() => void syncGeneratedFiles()}
                    className="rounded-lg border border-indigo-500/50 px-4 py-2 text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      !localAgentInfo
                        ? "Start and connect the Local Agent first."
                        : "Copy the saved generated files into the Local Agent workspace."
                    }
                  >
                    {syncingGeneratedFiles
                      ? "Syncing to PC..."
                      : "Sync files to PC"}
                  </button>
                  <button
                    disabled={
                      Boolean(localAction) ||
                      !localAgentInfo ||
                      !generatedFiles.length
                    }
                    onClick={() => void runLocalAction("build")}
                    className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {localAction === "build" ? "Building..." : "Build locally"}
                  </button>
                  <button
                    disabled={
                      Boolean(localAction) ||
                      !localAgentInfo ||
                      !generatedFiles.length
                    }
                    onClick={() => void runLocalAction("test")}
                    className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {localAction === "test" ? "Testing..." : "Test locally"}
                  </button>
                  <button
                    disabled={isBusy || !generatedFiles.length}
                    onClick={() => void review()}
                    className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {activeOperation === "review" && isBusy
                      ? "Reviewing..."
                      : "AI Review"}
                  </button>
                </div>
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-xs text-slate-400">
                      Local agent pairing token
                      <input
                        type="password"
                        autoComplete="off"
                        value={localAgentToken}
                        onChange={(event) => {
                          const token = event.target.value;
                          setLocalAgentToken(token);
                          setLocalAgentInfo(null);
                          setLocalAgentError(null);
                          setWorkspaceProjects([]);
                          setWorkspaceListing(null);
                          setWorkspaceEditorFile(null);
                          setWorkspaceEditorDraft("");
                        }}
                        placeholder="Paste the token shown in the agent terminal"
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                      />
                    </label>
                    <button
                      onClick={() => void connectLocalAgent()}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-indigo-400"
                    >
                      {localAgentInfo
                        ? "Reconnect agent"
                        : "Connect local agent"}
                    </button>
                  </div>
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
                      To start the Local Agent, open a terminal in the DevForge
                      project folder on your PC and run{" "}
                      <code>npm run agent:dev</code>. Keep that terminal open,
                      copy the pairing token printed there, paste it above, then
                      select <strong>Connect local agent</strong>.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Generated files are saved in your DevForge account first.
                    Use <strong>Sync files to PC</strong> to copy them into{" "}
                    <code>projects/{selected.id}</code>, or choose Build/Test to
                    sync and execute them. Import uploads up to 300 text files
                    and 2 MB; dependency/build folders and secret environment
                    files are skipped. Build and test scripts run on your PC;
                    only run projects you trust.
                  </p>
                </div>
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
              Ask follow-up questions about this project.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
            {!chatMessages.length && (
              <p className="text-slate-500">
                {selected
                  ? "Ask about the project plan, generated code, build errors, or what to do next."
                  : "Select a project to start asking questions."}
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
                  ? "Ask a question... (Ctrl+Enter to send)"
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

// Resolve the current session before rendering either the login or project UI.
function Root() {
  const isPublicGuide =
    window.location.pathname.replace(/\/+$/, "") === "/guide";
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
  return user ? <App user={user} /> : <Login />;
}

createRoot(document.getElementById("root")!).render(<Root />);
