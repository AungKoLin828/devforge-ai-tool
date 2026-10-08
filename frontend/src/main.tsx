import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, type User } from "./api";
import "./index.css";
function Login() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="glass max-w-lg w-full rounded-3xl p-10 shadow-2xl">
        <div className="text-indigo-400 text-sm font-semibold">
          DEVFORGE AI TOOL
        </div>
        <h1 className="text-4xl font-bold mt-2">Build software with AI.</h1>
        <p className="text-slate-400 mt-4 leading-7">
          Browser IDE, local execution, GitHub workflow, AI generation, testing
          and review.
        </p>
        <button
          onClick={() => api.login()}
          className="mt-8 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 font-semibold"
        >
          Continue with GitHub
        </button>
        <p className="text-xs text-slate-500 mt-4 text-center">
          GitHub OAuth is used for identity. Tokens stay server-side.
        </p>
      </div>
    </main>
  );
}
function App({ user }: { user: User }) {
  const [projects, setProjects] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [logs, setLogs] = useState<string[]>([]),
    [agent, setAgent] = useState<any>();
  async function load() {
    const [p, a] = await Promise.all([api.projects(), api.agent()]);
    setProjects(p.projects);
    setAgent(a.agent);
    if (!selected && p.projects[0])
      setSelected((await api.project(p.projects[0].id)).project);
  }
  useEffect(() => {
    load().catch(console.error);
  }, []);
  async function create() {
    const r = await api.createProject({
      name: "New DevForge Project",
      description: "AI generated software project",
      stack: "TypeScript + React + PostgreSQL",
    });
    setProjects((x) => [r.project, ...x]);
    setSelected(r.project);
  }
  async function generate() {
    if (!selected || !prompt.trim()) return;
    setBusy(true);
    setLogs([
      "Creating requirements...",
      "Designing architecture...",
      "Generating implementation plan...",
    ]);
    try {
      const r = await api.generate(selected.id, prompt);
      setLogs((x) => [
        ...x,
        `Generated ${r.files?.length || 0} files.`,
        "Review the generated plan before applying local changes.",
      ]);
      setSelected((await api.project(selected.id)).project);
      setProjects((await api.projects()).projects);
    } catch (e) {
      setLogs((x) => [
        ...x,
        `ERROR: ${e instanceof Error ? e.message : "Generation failed"}`,
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <header className="h-14 border-b border-slate-800 px-5 flex items-center justify-between">
        <div className="font-bold">
          DevForge <span className="text-indigo-400">AI</span>
        </div>
        <div className="flex gap-4 items-center text-sm">
          <span
            className={
              agent?.status === "CONNECTED"
                ? "text-emerald-400"
                : "text-amber-400"
            }
          >
            ● Agent {agent?.status || "Not paired"}
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
      <div className="flex-1 grid grid-cols-[250px_1fr_350px] min-h-0">
        <aside className="border-r border-slate-800 p-4 overflow-auto">
          <button
            onClick={create}
            className="w-full bg-indigo-600 rounded-lg py-2 mb-5"
          >
            + New Project
          </button>
          <div className="text-xs uppercase text-slate-500 mb-2">Projects</div>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                api.project(p.id).then((x) => setSelected(x.project))
              }
              className={`block w-full text-left rounded-lg p-3 mb-1 ${selected?.id === p.id ? "bg-slate-800" : "hover:bg-slate-900"}`}
            >
              <div>{p.name}</div>
              <div className="text-xs text-slate-500 mt-1">{p.status}</div>
            </button>
          ))}
        </aside>
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
                  {selected.workspace?.files?.length ? (
                    selected.workspace.files.map((f: any, i: number) => (
                      <div key={i} className="py-1 text-slate-300">
                        {f.path}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">
                      No generated files yet.
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 glass rounded-2xl p-4">
                <div className="text-sm font-semibold mb-3">
                  AI Project Builder
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-36 rounded-xl bg-slate-950 border border-slate-800 p-3 outline-none focus:border-indigo-500"
                  placeholder="Describe the software you want to build..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={busy}
                    onClick={generate}
                    className="bg-indigo-600 disabled:opacity-50 rounded-lg px-4 py-2"
                  >
                    {busy ? "Working..." : "Generate"}
                  </button>
                  <button
                    onClick={() =>
                      setLogs((x) => [
                        ...x,
                        "Build job queued for Local Agent.",
                      ])
                    }
                    className="bg-slate-800 rounded-lg px-4 py-2"
                  >
                    Build
                  </button>
                  <button
                    onClick={() => setLogs((x) => [...x, "Review job queued."])}
                    className="bg-slate-800 rounded-lg px-4 py-2"
                  >
                    AI Review
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
        <aside className="border-l border-slate-800 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800 font-semibold">
            AI Assistant
          </div>
          <div className="flex-1 p-4 overflow-auto text-sm">
            {logs.map((x, i) => (
              <div key={i} className="mb-3 text-slate-300">
                {x}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
            AI provider: OpenRouter · Local execution: Agent
          </div>
        </aside>
      </div>
      <footer className="h-9 border-t border-slate-800 px-4 flex items-center text-xs text-slate-500">
        IDE · Terminal · Build · Test · Review · Git · GitHub
      </footer>
    </div>
  );
}
function Root() {
  const [u, setU] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .me()
      .then((x) => setU(x.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        Loading DevForge...
      </div>
    );
  return u ? <App user={u} /> : <Login />;
}
createRoot(document.getElementById("root")!).render(<Root />);
