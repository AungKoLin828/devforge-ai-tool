import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  type LocalProjectResult,
  type LocalWorkspaceEntry,
  type LocalWorkspaceFile,
  type LocalWorkspaceListing,
  type User,
} from "./api";
import { useProjectGeneration } from "./hooks/useProjectGeneration";

function Login() {
  const capabilities = [
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
    ["01", "Generation you can verify", "Available"],
    ["02", "AI code review", "Available"],
    ["03", "Local project import, build and test", "Available"],
    ["04", "GitHub synchronization", "Planned"],
    ["05", "More AI providers", "Planned"],
  ];

  return (
    <main className="landing min-h-screen overflow-hidden">
      <header className="landing-nav mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-3 font-semibold tracking-tight" aria-label="DevForge AI home">
          <span className="brand-mark grid h-9 w-9 place-items-center rounded-xl text-sm font-black">D</span>
          <span>DevForge <span className="text-indigo-400">AI</span></span>
        </a>
        <button onClick={() => api.login()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400 hover:text-white">
          Sign in with GitHub
        </button>
      </header>

      <section className="landing-hero mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            FROM IDEA TO REVIEWABLE PROJECT
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Build with AI.
            <span className="landing-gradient block">Keep control of the code.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            DevForge turns your project brief into a structured plan and generated code,
            keeps the artifacts in PostgreSQL, and is designed to bring your local
            development workflow into the loop.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => api.login()} className="rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500">
              Continue with GitHub <span aria-hidden="true">→</span>
            </button>
            <a href="#how-it-works" className="rounded-xl border border-slate-700 px-6 py-3.5 text-center font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900">
              Explore the workflow
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            GitHub is used to sign in. Your AI provider key stays on the server.
          </p>
        </div>

        <div className="glass landing-preview rounded-2xl p-5 shadow-2xl shadow-indigo-950/20 sm:p-6" aria-label="Example generated project workflow">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <p className="text-xs text-slate-500">PROJECT WORKSPACE</p>
              <p className="mt-1 font-semibold text-slate-100">taskboard-app</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">READY</span>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ["✓", "Requirements", "Saved"],
              ["✓", "Architecture", "Saved"],
              ["✓", "Database & API design", "Saved"],
              ["✓", "Implementation plan", "Saved"],
              ["✓", "Generated code", "Saved"],
            ].map(([icon, title, status]) => (
              <div key={title} className="flex items-center gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5">
                <span className="text-emerald-400" aria-hidden="true">{icon}</span>
                <span className="flex-1 text-sm text-slate-200">{title}</span>
                <span className="text-xs text-slate-500">{status}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs leading-6 text-slate-400">
            <div><span className="text-indigo-300">src/</span> components/TaskBoard.tsx</div>
            <div><span className="text-indigo-300">src/</span> api/tasks.ts</div>
            <div><span className="text-indigo-300">prisma/</span> schema.prisma</div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">Example workflow preview</p>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-20 pt-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">A transparent workflow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">One workspace, from brief to build.</h2>
          <p className="mt-3 leading-7 text-slate-400">See what DevForge does today and what is being connected next.</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {capabilities.map((item) => (
            <article key={item.number} className="glass rounded-2xl p-6">
              <span className="text-sm font-semibold text-indigo-300">{item.number}</span>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-16 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Product roadmap</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Built in practical steps.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">The roadmap is explicit so you can distinguish working features from what is still being developed.</p>
          </div>
          <ol className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/40 px-5">
            {roadmap.map(([number, title, status]) => (
              <li key={number} className="flex items-center gap-4 py-4">
                <span className="font-mono text-xs text-slate-500">{number}</span>
                <span className="flex-1 text-sm text-slate-200">{title}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${status === "Available" ? "bg-emerald-400/10 text-emerald-300" : status === "In progress" ? "bg-amber-400/10 text-amber-300" : "bg-slate-800 text-slate-400"}`}>{status}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>DevForge AI · Your projects stay yours.</span>
          <span>© {new Date().getFullYear()} Aung Ko Lin. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}

function App({ user }: { user: User }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>();
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
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
  const [workspaceBrowserError, setWorkspaceBrowserError] = useState<string | null>(null);
  const [workspaceEditorFile, setWorkspaceEditorFile] =
    useState<LocalWorkspaceFile | null>(null);
  const [workspaceEditorDraft, setWorkspaceEditorDraft] = useState("");
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [localAction, setLocalAction] = useState<"build" | "test" | null>(null);
  const [localResult, setLocalResult] = useState<LocalProjectResult | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const { status: generationStatus, operation: activeOperation, runId, error: generationError, isBusy, generate: runGeneration, review: runReview, reset: resetGeneration } = useProjectGeneration();

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
      setLogs((current) => [...current, `ERROR: ${cause instanceof Error ? cause.message : "Could not load projects."}`]);
    });
    // Initial page load only. Selection changes are handled by the project buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      resetGeneration();
    } catch (cause) {
      setLogs((current) => [...current, `ERROR: ${cause instanceof Error ? cause.message : "Could not create project."}`]);
    }
  }

  async function deleteProject(project: { id: string; name: string }) {
    const confirmed = window.confirm(
      `Permanently delete "${project.name}" and its saved artifacts, runs, and history? Any copy already synced to your PC will not be deleted.`,
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
    } catch (cause) {
      setLogs((current) => [
        ...current,
        `ERROR: ${cause instanceof Error ? cause.message : "Could not delete project."}`,
      ]);
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function generate() {
    if (!selected || isBusy) return;
    if (!prompt.trim()) {
      setLogs((current) => [...current, "Enter a project description before generating."]);
      return;
    }

    setLogs((current) => [...current, "Starting AI project generation..."]);
    try {
      const completedRun = await runGeneration(selected.id, prompt);
      if (!completedRun) return;
      setLogs((current) => [...current, "Generation completed."]);
      const [projectResponse, projectsResponse] = await Promise.all([
        api.project(selected.id),
        api.projects(),
      ]);
      setSelected(projectResponse.project);
      setProjects(projectsResponse.projects);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Generation failed.";
      setLogs((current) => [...current, `ERROR: ${message}`]);
      // Keep the page usable after 400/409/network errors; the hook also clears its busy flag in finally.
    }
  }

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
    } catch (cause) {
      setLogs((current) => [
        ...current,
        `ERROR: ${cause instanceof Error ? cause.message : "Could not load review results."}`,
      ]);
    }
  }

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
        cause instanceof Error ? cause.message : "Could not load this workspace folder.",
      );
    } finally {
      setWorkspaceEntriesLoading(false);
    }
  }

  async function browseWorkspaceDirectory(directory: string) {
    if (
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !window.confirm("Discard unsaved edits and open this folder?")
    ) {
      return;
    }
    setWorkspaceEditorFile(null);
    setWorkspaceEditorDraft("");
    await loadWorkspaceDirectory(directory);
  }

  async function openWorkspaceFile(entry: LocalWorkspaceEntry) {
    if (entry.type !== "file" || entry.editable === false) return;
    if (
      workspaceEditorFile &&
      workspaceEditorDraft !== workspaceEditorFile.content &&
      !window.confirm("Discard unsaved edits and open another file?")
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
    } catch (cause) {
      setWorkspaceBrowserError(
        cause instanceof Error ? cause.message : "Could not save this file.",
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function connectLocalAgent() {
    const token = localAgentToken.trim();
    if (!token) {
      setLocalAgentError("Enter the pairing token printed by your local agent.");
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
        cause instanceof Error ? cause.message : "Could not connect to the local agent.",
      );
    }
  }

  async function importLocalProject() {
    const source = workspaceProjects.find(
      (project) => project.path === localImportPath,
    );
    if (!source || !localAgentInfo || importingProject) return;

    if (
      !window.confirm(
        `Import text files from "${source.path}" into your DevForge account? Files are uploaded to the server for storage and AI review. Secret environment files and generated dependency/build folders are excluded; review source files for other credentials before importing.`,
      )
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
      setLocalResult(null);
      resetGeneration();
      setLogs((current) => [
        ...current,
        `Imported ${localProject.project.files.length} files from ${source.path}. The project is ready for AI review and local build/test.`,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not import the local project.";
      setLocalAgentError(message);
      setLogs((current) => [...current, `ERROR: ${message}`]);
    } finally {
      setImportingProject(false);
    }
  }

  async function runLocalAction(action: "build" | "test") {
    if (!selected || !localAgentInfo || !generatedFiles.length || localAction) {
      return;
    }

    const label = action === "build" ? "build" : "test";
    if (
      !window.confirm(
        `This will copy the generated files to your PC (overwriting matching files in this DevForge project folder) and run the project's ${label} scripts locally. Project scripts may execute arbitrary code. Continue only if you trust this generated project.`,
      )
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

  async function selectProject(projectId: string) {
    try {
      const response = await api.project(projectId);
      setSelected(response.project);
      setPrompt("");
      resetGeneration();
    } catch (cause) {
      setLogs((current) => [...current, `ERROR: ${cause instanceof Error ? cause.message : "Could not open project."}`]);
    }
  }

  const artifacts = Array.isArray(selected?.artifacts) ? selected.artifacts : [];
  const codeArtifact = artifacts.find((artifact: any) => artifact.type === "CODE");
  const codeContent = codeArtifact?.content;
  const generatedFiles = Array.isArray(codeContent) ? codeContent : [];
  const planArtifacts = artifacts.filter(
    (artifact: any) =>
      artifact.type !== "CODE" && artifact.type !== "REVIEW",
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

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <header className="h-14 border-b border-slate-800 px-5 flex items-center justify-between">
        <div className="font-bold">DevForge <span className="text-indigo-400">AI</span></div>
        <div className="flex gap-4 items-center text-sm">
          <span className={localAgentInfo ? "text-emerald-400" : "text-amber-400"}>● Local Agent {localAgentInfo ? "Connected" : "Not connected"}</span>
          <span className="text-slate-400">{user.githubUsername || user.email}</span>
          <button onClick={() => api.logout().then(() => location.reload())} className="text-slate-400 hover:text-white">Logout</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[250px_1fr_350px] min-h-0">
        <aside className="border-r border-slate-800 p-4 overflow-auto">
          <button onClick={create} className="w-full bg-indigo-600 rounded-lg py-2 mb-5">+ New Project</button>
          <div className="text-xs uppercase text-slate-500 mb-2">Projects</div>
          {projects.map((project) => (
            <div key={project.id} className={`mb-1 rounded-lg ${selected?.id === project.id ? "bg-slate-800" : "hover:bg-slate-900"}`}>
              <button
                onClick={() => void selectProject(project.id)}
                className="block w-full rounded-t-lg p-3 text-left"
              >
                <div>{project.name}</div>
                <div className="mt-1 text-xs text-slate-500">{project.status}</div>
              </button>
              <button
                type="button"
                disabled={deletingProjectId !== null}
                onClick={() => void deleteProject(project)}
                className="w-full rounded-b-lg px-3 pb-2 text-left text-xs text-slate-500 transition hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
                aria-label={`Delete ${project.name}`}
              >
                {deletingProjectId === project.id ? "Deleting..." : "Delete project"}
              </button>
            </div>
          ))}
        </aside>

        <main className="min-w-0 overflow-auto p-6">
          {!selected ? (
            <div className="h-full grid place-items-center text-slate-500">Create a project to begin.</div>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <div><h2 className="text-2xl font-bold">{selected.name}</h2><p className="text-slate-400 mt-1">{selected.description}</p></div>
                <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs">{selected.status}</span>
              </div>

              <div className="mt-6 glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 font-semibold">Explorer</div>
                <div className="p-4 font-mono text-sm">
                  {generatedFiles.length ? generatedFiles.map((file: any, index: number) => <div key={file.path || index} className="py-1 text-slate-300">{file.path}</div>) : <div className="text-slate-500">No generated files saved yet.</div>}
                </div>
              </div>

              <section className="mt-5 glass overflow-hidden rounded-2xl" aria-label="Local workspace browser">
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
                          onClick={() => void browseWorkspaceDirectory(workspaceListing.parent!)}
                          disabled={workspaceEntriesLoading}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 disabled:opacity-50"
                        >
                          Up
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => void loadWorkspaceDirectory(workspaceListing?.path || "")}
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
                      <p className="p-2 text-sm text-slate-500">Connect the Local Agent to view your workspace.</p>
                    ) : workspaceEntriesLoading && !workspaceListing ? (
                      <p className="p-2 text-sm text-slate-500">Loading workspace files...</p>
                    ) : !workspaceListing?.entries.length ? (
                      <p className="p-2 text-sm text-slate-500">This folder is empty.</p>
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
                              (entry.type === "file" && entry.editable === false)
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
                            <span className="mr-2 text-slate-500" aria-hidden="true">
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
                          <span className="truncate font-mono text-slate-300">{workspaceEditorFile.path}</span>
                          {workspaceEditorDraft !== workspaceEditorFile.content && (
                            <span className="shrink-0 text-amber-300">Unsaved changes</span>
                          )}
                        </div>
                        <textarea
                          aria-label={`Edit ${workspaceEditorFile.path}`}
                          spellCheck={false}
                          value={workspaceEditorDraft}
                          onChange={(event) => setWorkspaceEditorDraft(event.target.value)}
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
                  {workspaceBrowserError && (
                    <p role="alert" className="mb-2 text-xs text-red-300">{workspaceBrowserError}</p>
                  )}
                  <p className="text-xs leading-5 text-slate-500">
                    Saving writes directly to the selected local file. Hidden/secret files, dependency folders, symlinks, binary files, and files over 1 MB are not editable here. Review your changes before saving.
                  </p>
                </div>
              </section>

              {planArtifacts.length > 0 && (
                <div className="mt-5 glass rounded-2xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">Saved project artifacts</div>
                    <span className="text-xs text-slate-500">Stored in PostgreSQL</span>
                  </div>
                  <div className="space-y-2">
                    {planArtifacts.map((artifact: any) => (
                      <details key={artifact.id} className="rounded-lg border border-slate-800 bg-slate-950/60">
                        <summary className="cursor-pointer px-3 py-2.5 text-sm text-slate-300">
                          {artifact.name}
                        </summary>
                        <pre className="max-h-72 overflow-auto border-t border-slate-800 p-3 text-xs leading-5 text-slate-400">{JSON.stringify(artifact.content, null, 2)}</pre>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {latestReview && (
                <section className="mt-5 glass rounded-2xl p-4" aria-label="Latest AI code review">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Latest AI code review</div>
                    <span className="text-xs text-slate-500">
                      {reviewFindings.length} finding{reviewFindings.length === 1 ? "" : "s"} · saved
                    </span>
                  </div>
                  {typeof reviewContent?.summary === "string" && (
                    <p className="mt-3 text-sm leading-6 text-slate-300">{reviewContent.summary}</p>
                  )}
                  <div className="mt-3 space-y-2">
                    {reviewFindings.length ? reviewFindings.map((finding: any, index: number) => (
                      <details key={`${finding.filePath}-${finding.title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/60">
                        <summary className="cursor-pointer px-3 py-2.5 text-sm text-slate-200">
                          <span className={`mr-2 text-xs font-semibold ${finding.severity === "CRITICAL" || finding.severity === "HIGH" ? "text-red-300" : finding.severity === "MEDIUM" ? "text-amber-300" : "text-slate-400"}`}>{finding.severity}</span>
                          {finding.title}
                          <span className="ml-2 text-xs text-slate-500">{finding.filePath}</span>
                        </summary>
                        <div className="space-y-3 border-t border-slate-800 p-3 text-sm">
                          <p className="leading-6 text-slate-400">{finding.description}</p>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-300">Suggested fix</p>
                            <p className="leading-6 text-slate-300">{finding.suggestedFix}</p>
                          </div>
                        </div>
                      </details>
                    )) : (
                      <p className="rounded-lg bg-slate-950/60 p-3 text-sm text-emerald-300">No actionable findings.</p>
                    )}
                  </div>
                </section>
              )}

              <div className="mt-5 glass rounded-2xl p-4">
                <div className="text-sm font-semibold mb-3">AI Project Builder</div>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={isBusy} className="w-full h-36 rounded-xl bg-slate-950 border border-slate-800 p-3 outline-none focus:border-indigo-500 disabled:opacity-60" placeholder="Describe the software you want to build..." />
                <div className="flex gap-2 mt-3">
                  <button disabled={isBusy} onClick={() => void generate()} className="bg-indigo-600 disabled:opacity-50 rounded-lg px-4 py-2">{activeOperation === "generate" && generationStatus === "STARTING" ? "Starting..." : activeOperation === "generate" && generationStatus === "RUNNING" ? "Generating..." : "Generate"}</button>
                  <button disabled={Boolean(localAction) || !localAgentInfo || !generatedFiles.length} onClick={() => void runLocalAction("build")} className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">{localAction === "build" ? "Building..." : "Build locally"}</button>
                  <button disabled={Boolean(localAction) || !localAgentInfo || !generatedFiles.length} onClick={() => void runLocalAction("test")} className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">{localAction === "test" ? "Testing..." : "Test locally"}</button>
                  <button disabled={isBusy || !generatedFiles.length} onClick={() => void review()} className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">{activeOperation === "review" && isBusy ? "Reviewing..." : "AI Review"}</button>
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
                    <button onClick={() => void connectLocalAgent()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-indigo-400">
                      {localAgentInfo ? "Reconnect agent" : "Connect local agent"}
                    </button>
                  </div>
                  {localAgentInfo && (
                    <p className="mt-3 text-xs text-emerald-300">
                      Connected to {localAgentInfo.machine} ({localAgentInfo.platform}). Workspace: {localAgentInfo.workspaceRoot}
                    </p>
                  )}
                  {localAgentInfo && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs text-slate-400">
                        Import a folder from this workspace
                        <select
                          value={localImportPath}
                          onChange={(event) => setLocalImportPath(event.target.value)}
                          disabled={!workspaceProjects.length || importingProject}
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                        >
                          {!workspaceProjects.length && <option value="">No project folders found</option>}
                          {workspaceProjects.map((project) => (
                            <option key={project.path} value={project.path}>{project.name}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => void importLocalProject()}
                        disabled={!localImportPath || importingProject}
                        className="rounded-lg border border-indigo-500/50 px-4 py-2 text-sm text-indigo-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importingProject ? "Importing..." : "Import local project"}
                      </button>
                    </div>
                  )}
                  {localAgentError && (
                    <p role="alert" className="mt-3 text-xs text-red-300">{localAgentError}</p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Import uploads up to 300 text files and 2 MB from a folder in the agent workspace; dependency/build folders and secret environment files are skipped. Imported source is stored in your account for AI review. Build and test scripts run on your PC; only connect to projects you trust.
                  </p>
                </div>
                {localResult && (
                  <div className="mt-4 space-y-3">
                    {localResult.stages.map((stage, index) => (
                      <details key={`${stage.name}-${index}`} open={stage.code !== 0} className="rounded-lg border border-slate-800 bg-slate-950/70">
                        <summary className={`cursor-pointer px-3 py-2.5 text-sm ${stage.code === 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {stage.name} · {stage.command} · exit {stage.code ?? "unknown"}
                        </summary>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-slate-800 p-3 text-xs leading-5 text-slate-300">{[stage.stdout, stage.stderr && `STDERR:\n${stage.stderr}`, stage.truncated && "[Output truncated at 128 KB]"].filter(Boolean).join("\n\n") || "No command output."}</pre>
                      </details>
                    ))}
                  </div>
                )}
                {isBusy && <p className="mt-3 text-sm text-amber-300">{activeOperation === "review" ? "AI review is in progress. You can keep this page open; please avoid submitting another operation for this project." : "Generation is in progress. You can keep this page open; please avoid submitting another operation for this project."}</p>}
                {runId && <p className="mt-2 text-xs text-slate-500">Project run: {runId}</p>}
                {generationError && (
                  <div role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
                    <p>{generationError}</p>
                    <button onClick={resetGeneration} className="mt-2 underline underline-offset-2">Dismiss error</button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="border-l border-slate-800 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800 font-semibold">AI Assistant</div>
          <div className="flex-1 p-4 overflow-auto text-sm">
            {logs.map((entry, index) => <div key={`${index}-${entry}`} className="mb-3 text-slate-300">{entry}</div>)}
          </div>
        </aside>
      </div>

      <footer className="h-9 border-t border-slate-800 px-4 flex items-center text-xs text-slate-500">IDE · Terminal · Build · Test · Review · Git · GitHub</footer>
    </div>
  );
}

function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.me().then((response) => setUser(response.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="min-h-screen grid place-items-center">Loading DevForge...</div>;
  return user ? <App user={user} /> : <Login />;
}

createRoot(document.getElementById("root")!).render(<Root />);
