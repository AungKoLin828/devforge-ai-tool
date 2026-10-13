import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, type User } from "./api";
import { useProjectGeneration } from "./hooks/useProjectGeneration";
import "./index.css";

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
        "A restricted-workspace local agent is part of the roadmap for building and testing generated code on your PC.",
    },
  ];

  const roadmap = [
    ["01", "Generation you can verify", "Available"],
    ["02", "AI code review", "Available"],
    ["03", "Local build and test agent", "In progress"],
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
  const [agent, setAgent] = useState<any>();
  const { status: generationStatus, operation: activeOperation, runId, error: generationError, isBusy, generate: runGeneration, review: runReview, reset: resetGeneration } = useProjectGeneration();

  async function load() {
    const [projectResponse, agentResponse] = await Promise.all([api.projects(), api.agent()]);
    setProjects(projectResponse.projects);
    setAgent(agentResponse.agent);
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
          <span className={agent?.status === "CONNECTED" ? "text-emerald-400" : "text-amber-400"}>● Agent {agent?.status || "Not paired"}</span>
          <span className="text-slate-400">{user.githubUsername || user.email}</span>
          <button onClick={() => api.logout().then(() => location.reload())} className="text-slate-400 hover:text-white">Logout</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[250px_1fr_350px] min-h-0">
        <aside className="border-r border-slate-800 p-4 overflow-auto">
          <button onClick={create} className="w-full bg-indigo-600 rounded-lg py-2 mb-5">+ New Project</button>
          <div className="text-xs uppercase text-slate-500 mb-2">Projects</div>
          {projects.map((project) => (
            <button key={project.id} onClick={() => void selectProject(project.id)} className={`block w-full text-left rounded-lg p-3 mb-1 ${selected?.id === project.id ? "bg-slate-800" : "hover:bg-slate-900"}`}>
              <div>{project.name}</div>
              <div className="text-xs text-slate-500 mt-1">{project.status}</div>
            </button>
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
                  <button disabled title="Local build and test workflow is not connected in the web app yet." className="cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2 text-slate-500">Build · coming soon</button>
                  <button disabled={isBusy || !generatedFiles.length} onClick={() => void review()} className="rounded-lg bg-slate-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">{activeOperation === "review" && isBusy ? "Reviewing..." : "AI Review"}</button>
                </div>
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
          <div className="p-4 border-t border-slate-800 text-xs text-slate-500">AI provider: OpenRouter · Local execution: Agent</div>
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
