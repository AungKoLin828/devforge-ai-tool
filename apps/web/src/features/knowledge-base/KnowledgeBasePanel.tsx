import { useEffect, useRef, useState } from "react";
import {
  api,
  type AIProvider,
  type RagCitation,
  type RagJob,
  type RagSource,
} from "../../api";

type Props = {
  projectId: string;
  provider: AIProvider;
  onClose: () => void;
};

const MAX_FILE_BYTES = 512 * 1024;
const FILE_TYPES =
  ".md,.mdx,.txt,.rst,.html,.htm,.json,.yaml,.yml,.toml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cs,.php,.rb,.swift,.sh,.sql,.css,.xml,.csv";

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "The knowledge base request failed.";
}

function SourceLink({ citation }: { citation: RagCitation }) {
  const label = citation.path || citation.uri;
  if (!citation.uri.startsWith("https://")) {
    return <span className="break-all text-slate-400">{label}</span>;
  }
  return (
    <a
      href={citation.uri}
      target="_blank"
      rel="noreferrer"
      className="break-all text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
    >
      {label}
    </a>
  );
}

export function KnowledgeBasePanel({ projectId, provider, onClose }: Props) {
  const [sources, setSources] = useState<RagSource[]>([]);
  const [jobs, setJobs] = useState<RagJob[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [url, setUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RagCitation[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const previousJobStatuses = useRef(new Map<string, RagJob["status"]>());

  async function loadSources() {
    setLoading(true);
    setError("");
    try {
      const [response, providers] = await Promise.all([
        api.rag.sources(projectId),
        api.providers(),
      ]);
      setSources(response.sources);
      setEmbeddingModel(
        providers.providers.find((item) => item.provider === provider)
          ?.embeddingModel ?? "",
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs() {
    try {
      const response = await api.rag.jobs(projectId);
      setJobs(response.jobs);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  useEffect(() => {
    void loadSources();
    void loadJobs();
  }, [projectId, provider]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING")) {
      return;
    }
    const timer = setInterval(() => {
      void loadJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [jobs, projectId, provider]);

  useEffect(() => {
    let completedSuccessfully = false;
    for (const job of jobs) {
      const previous = previousJobStatuses.current.get(job.id);
      if (job.status === "SUCCESS" && previous !== "SUCCESS") {
        completedSuccessfully = true;
      }
      previousJobStatuses.current.set(job.id, job.status);
    }
    if (completedSuccessfully) void loadSources();
  }, [jobs]);

  async function runSourceAction(
    action: () => Promise<{ run: RagJob }>,
    message: string,
  ): Promise<boolean> {
    if (working) return false;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await action();
      setJobs((current) => [
        response.run,
        ...current.filter((job) => job.id !== response.run.id),
      ]);
      setResults([]);
      setNotice(`${message} Job ${response.run.id.slice(0, 8)} is queued.`);
      return true;
    } catch (cause) {
      setError(errorText(cause));
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function addDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runSourceAction(
      () =>
        api.rag.addDocument(projectId, {
          name: documentName.trim(),
          content: documentText,
          provider,
        }),
      "Document indexing started.",
    );
    if (saved) {
      setDocumentName("");
      setDocumentText("");
    }
  }

  async function addUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runSourceAction(
      () => api.rag.addUrl(projectId, url.trim(), provider),
      "Web page indexing started.",
    );
    if (saved) setUrl("");
  }

  async function addGitHub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runSourceAction(
      () => api.rag.addGitHub(projectId, githubUrl.trim(), provider),
      "GitHub snapshot indexing started.",
    );
    if (saved) setGithubUrl("");
  }

  async function indexProject() {
    await runSourceAction(
      () => api.rag.indexProject(projectId, provider),
      "Saved project file indexing started.",
    );
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await api.rag.search(projectId, query.trim(), provider);
      setResults(response.results);
      if (!response.results.length) {
        setNotice("No matching passages were found in this project knowledge base.");
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setWorking(false);
    }
  }

  async function deleteSource(sourceId: string) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await api.rag.deleteSource(projectId, sourceId);
      setSources((current) => current.filter((source) => source.id !== sourceId));
      setResults([]);
      setConfirmDeleteId(null);
      setNotice("Knowledge source and its indexed chunks were removed.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setWorking(false);
    }
  }

  async function retryJob(jobId: string) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await api.rag.retryJob(projectId, jobId);
      await loadJobs();
      setNotice("Indexing job queued for retry.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setWorking(false);
    }
  }

  async function cancelJob(jobId: string) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await api.rag.cancelJob(projectId, jobId);
      await loadJobs();
      setNotice("Queued indexing job cancelled.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setWorking(false);
    }
  }

  async function readDocumentFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Choose a text file no larger than 512 KB.");
      return;
    }
    try {
      setDocumentName(file.name);
      setDocumentText(await file.text());
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/75 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-base-title"
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-700 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
              Project RAG
            </p>
            <h2 id="knowledge-base-title" className="mt-1 text-xl font-bold text-white">
              Knowledge Base
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-400">
              Index documents, public web pages, GitHub repositories, and saved
              project files. Chat retrieves passages and cites its sources.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-auto p-5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">
            Indexing sends source text to the selected {provider} provider to
            create embeddings. Search combines semantic similarity with
            PostgreSQL full-text ranking. Only import sources you are allowed
            to share with that provider; check text files for credentials before
            indexing because secret-like filenames are skipped, but file contents
            are not automatically redacted.
          </div>

          {(error || notice) && (
            <p
              role={error ? "alert" : "status"}
              className={`rounded-lg border p-3 text-sm ${
                error
                  ? "border-red-500/30 bg-red-500/5 text-red-200"
                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
              }`}
            >
              {error || notice}
            </p>
          )}

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">Project files</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Queue indexing for the latest saved CODE artifact. Re-index when the files change.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void indexProject()}
                disabled={working}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {working ? "Queuing..." : "Queue project indexing"}
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">
                  Indexing jobs ({jobs.length})
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Imports run in the background. Queued jobs can be cancelled;
                  failed jobs can be retried.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadJobs()}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
              >
                Refresh jobs
              </button>
            </div>
            {!jobs.length && (
              <p className="text-sm text-slate-500">No indexing jobs yet.</p>
            )}
            {jobs.map((job) => (
              <article
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">
                    {job.status} · job {job.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {new Date(job.createdAt).toLocaleString()}
                    {job.finishedAt
                      ? ` · Finished ${new Date(job.finishedAt).toLocaleString()}`
                      : ""}
                  </p>
                  {job.error && (
                    <p className="mt-2 break-words text-xs text-red-300">
                      {job.error}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {job.status === "FAILED" && (
                    <button
                      type="button"
                      onClick={() => void retryJob(job.id)}
                      disabled={working}
                      className="rounded-md border border-indigo-500/50 px-2.5 py-1.5 text-xs text-indigo-200 disabled:opacity-50"
                    >
                      Retry
                    </button>
                  )}
                  {job.status === "QUEUED" && (
                    <button
                      type="button"
                      onClick={() => void cancelJob(job.id)}
                      disabled={working}
                      className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <form
              onSubmit={(event) => void addDocument(event)}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="font-semibold text-slate-100">Upload or paste text</h3>
              <input
                type="file"
                accept={FILE_TYPES}
                disabled={working}
                onChange={(event) => void readDocumentFile(event.target.files?.[0])}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:text-slate-200"
              />
              <input
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
                maxLength={200}
                required
                placeholder="Document name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
              <textarea
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
                maxLength={512 * 1024}
                required
                rows={5}
                placeholder="Paste Markdown, notes, or other UTF-8 text"
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={working || !documentName.trim() || !documentText.trim()}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:opacity-50"
              >
                Add document
              </button>
            </form>

            <div className="space-y-4">
              <form
                onSubmit={(event) => void addUrl(event)}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <h3 className="font-semibold text-slate-100">Public web page</h3>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  maxLength={2048}
                  required
                  placeholder="https://example.com/docs"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={working || !url.trim()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:opacity-50"
                >
                  Import URL
                </button>
              </form>

              <form
                onSubmit={(event) => void addGitHub(event)}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <h3 className="font-semibold text-slate-100">GitHub repository</h3>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  maxLength={2048}
                  required
                  placeholder="https://github.com/owner/repository"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={working || !githubUrl.trim()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400 disabled:opacity-50"
                >
                  Import GitHub snapshot
                </button>
                <p className="text-xs leading-5 text-slate-500">
                  Uses your connected GitHub account. Imports up to 100 text files
                  and 512 KB; secret files and build/dependency folders are skipped.
                </p>
              </form>
            </div>
          </div>

          <section className="space-y-3 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">
                  Indexed sources ({sources.length})
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {loading
                    ? "Loading knowledge sources..."
                    : `${sources.reduce((total, source) => total + source.chunkCount, 0)} searchable passages`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSources()}
                disabled={loading || working}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            {sources.some(
              (source) =>
                source.embeddingProvider !== provider ||
                (embeddingModel && source.embeddingModel !== embeddingModel),
            ) && (
              <p className="text-xs leading-5 text-amber-200/80">
                Some sources use a different embedding provider or model.
                Full-text search still includes them; re-index with {provider}
                to enable semantic search for those sources.
              </p>
            )}
            {!loading && !sources.length && (
              <p className="rounded-lg bg-slate-900 p-3 text-sm text-slate-400">
                No sources yet. Add a document or index project files to enable
                retrieval-augmented project chat.
              </p>
            )}
            {sources.map((source) => (
              <article
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {source.name}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {source.kind} · {source.chunkCount} chunks ·{" "}
                    {source.embeddingProvider} / {source.embeddingModel}
                  </p>
                </div>
                {confirmDeleteId === source.id ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void deleteSource(source.id)}
                      disabled={working}
                      className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs text-red-200 disabled:opacity-50"
                    >
                      Confirm remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={working}
                      className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(source.id)}
                    disabled={working}
                    className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-200 hover:border-red-400 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </article>
            ))}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 p-4">
            <h3 className="font-semibold text-slate-100">Test retrieval</h3>
            <form onSubmit={(event) => void search(event)} className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={1000}
                placeholder="Search project knowledge..."
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={working || !query.trim() || !sources.length}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Search
              </button>
            </form>
            {results.map((result, index) => (
              <article key={result.id} className="rounded-lg bg-slate-900 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-indigo-300">
                    [{index + 1}] {result.sourceName}
                  </span>
                  <SourceLink citation={result} />
                </div>
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-300">
                  {result.excerpt}
                </p>
              </article>
            ))}
          </section>
        </div>
      </section>
    </div>
  );
}
