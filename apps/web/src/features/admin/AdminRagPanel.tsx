import { useEffect, useState } from "react";
import {
  api,
  type RagAdminSettings,
  type RagTaskProfile,
} from "../../api";

const BOOLEAN_FIELDS: Array<{ key: keyof RagAdminSettings; label: string }> = [
  { key: "enabled", label: "Enable RAG" },
  { key: "enableGlobalKnowledge", label: "Global knowledge" },
  { key: "enablePersonalKnowledge", label: "Personal knowledge" },
  { key: "enableProjectKnowledge", label: "Project knowledge" },
  { key: "enableWorkspaceKnowledge", label: "Workspace knowledge" },
  { key: "enableCitations", label: "Citations" },
  { key: "enableRagLogging", label: "RAG logging" },
  { key: "fallbackWithoutRag", label: "Fallback without RAG" },
  { key: "enableRagEvaluation", label: "RAG evaluation" },
  { key: "vectorSearchEnabled", label: "Vector search" },
  { key: "keywordSearchEnabled", label: "Keyword search" },
  { key: "enableMetadataFiltering", label: "Metadata filtering" },
  { key: "enableRrf", label: "Reciprocal Rank Fusion" },
  { key: "enableReranking", label: "Reranking (optional)" },
  { key: "contextDeduplication", label: "Context deduplication" },
  { key: "includeSourceMetadata", label: "Include source metadata" },
  { key: "includeFilePath", label: "Include file path" },
  { key: "includeLineNumbers", label: "Include line numbers" },
];

const NUMBER_FIELDS: Array<{ key: keyof RagAdminSettings; label: string; min: number; max: number; step: number }> = [
  { key: "retrievalStrategyTopK", label: "Top K candidates", min: 1, max: 100, step: 1 },
  { key: "maxContextChunks", label: "Max context chunks", min: 1, max: 40, step: 1 },
  { key: "maxContextTokens", label: "Max context tokens", min: 500, max: 32000, step: 100 },
  { key: "rrfK", label: "RRF K parameter", min: 1, max: 1000, step: 1 },
  { key: "embeddingBatchSize", label: "Embedding batch size", min: 1, max: 128, step: 1 },
  { key: "embeddingRequestTimeoutMs", label: "Embedding timeout (ms)", min: 5000, max: 120000, step: 1000 },
  { key: "embeddingRetryCount", label: "Embedding retries", min: 0, max: 5, step: 1 },
];

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

/** Admin RAG configuration panel: global settings, task profiles and playground. */
export function AdminRagPanel() {
  const [settings, setSettings] = useState<RagAdminSettings | null>(null);
  const [profiles, setProfiles] = useState<RagTaskProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [testResults, setTestResults] = useState<
    Array<{ sourceName: string; uri: string; excerpt: string; path?: string }>
  >([]);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  async function load() {
    try {
      const [settingsResponse, profilesResponse] = await Promise.all([
        api.adminRagSettings(),
        api.adminRagTaskProfiles(),
      ]);
      setSettings(settingsResponse.settings);
      setProfiles(profilesResponse.profiles);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load RAG settings");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(patch: Partial<RagAdminSettings>) {
    setBusy(true);
    try {
      const response = await api.adminUpdateRagSettings(patch);
      setSettings(response.settings);
      setStatus("Settings saved");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(task: string, patch: Partial<RagTaskProfile>) {
    setBusy(true);
    try {
      const response = await api.adminUpdateRagTaskProfile(task, patch);
      setProfiles((current) =>
        current.map((profile) => (profile.task === task ? response.profile : profile)),
      );
      setStatus(`Profile ${task} saved`);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTestQuery() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const projectId = window.prompt(
        "Enter the project ID to test retrieval against:",
      );
      if (!projectId) return;
      const response = await api.adminRagTestQuery({
        projectId,
        query: query.trim(),
      });
      setTestResults(response.results ?? []);
      setTestLatency(response.latencyMs);
      setError(null);
      setStatus(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test query failed");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
        <p>{error ?? "Loading RAG configuration..."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold">RAG Configuration</h1>
          <p className="mt-1 text-sm text-slate-400">
            Centralized retrieval settings applied to the shared backend AI and
            RAG engines for both the web app and the VS Code extension. Changes
            take effect without redeployment and are audited.
          </p>
        </header>

        {error && (
          <div className="rounded-md border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-md border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        )}

        <section className="rounded-lg border border-slate-800 p-5">
          <h2 className="mb-3 text-lg font-medium">General</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOOLEAN_FIELDS.map((field) => (
              <Toggle
                key={String(field.key)}
                label={field.label}
                value={Boolean(settings[field.key])}
                onChange={(value) => save({ [field.key]: value } as Partial<RagAdminSettings>)}
              />
            ))}
          </div>
          <label className="mt-4 block text-sm">
            Retrieval strategy
            <select
              value={settings.retrievalStrategy}
              onChange={(event) => save({ retrievalStrategy: event.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="hybrid">Hybrid (vector + keyword)</option>
              <option value="vector">Vector only</option>
              <option value="keyword">Keyword only</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">
            No-result behavior
            <select
              value={settings.noResultBehavior}
              onChange={(event) => save({ noResultBehavior: event.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="fallback">Fallback (continue without context)</option>
              <option value="empty">Return empty context</option>
            </select>
          </label>
        </section>

        <section className="rounded-lg border border-slate-800 p-5">
          <h2 className="mb-3 text-lg font-medium">Retrieval and Ranking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUMBER_FIELDS.map((field) => (
              <label key={String(field.key)} className="block text-sm">
                {field.label}
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={Number(settings[field.key])}
                  onChange={(event) =>
                    save({ [field.key]: Number(event.target.value) } as Partial<RagAdminSettings>)
                  }
                  className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
            ))}
            <label className="block text-sm">
              Minimum similarity
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.minSimilarity}
                onChange={(event) =>
                  save({ minSimilarity: Number(event.target.value) })
                }
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 p-5">
          <h2 className="mb-3 text-lg font-medium">Embedding Configuration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Embedding provider
              <select
                value={settings.embeddingProvider}
                onChange={(event) =>
                  save({ embeddingProvider: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <option value="OPENROUTER">OpenRouter</option>
                <option value="OPENAI">OpenAI</option>
                <option value="CUSTOM">Custom OpenAI-compatible</option>
              </select>
            </label>
            <label className="block text-sm">
              Embedding model
              <input
                type="text"
                value={settings.embeddingModel}
                onChange={(event) =>
                  save({ embeddingModel: event.target.value })
                }
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Embedding dimensions
              <input
                type="number"
                min={64}
                max={4096}
                value={settings.embeddingDimensions}
                onChange={(event) =>
                  save({ embeddingDimensions: Number(event.target.value) })
                }
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Changing the embedding model requires re-indexing existing sources;
            incompatible vectors are never mixed.
          </p>
        </section>

        <section className="rounded-lg border border-slate-800 p-5">
          <h2 className="mb-3 text-lg font-medium">AI Task Profiles</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Task</th>
                  <th>Enabled</th>
                  <th>Strategy</th>
                  <th>Top K</th>
                  <th>Chunks</th>
                  <th>Min sim.</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.task} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{profile.task}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={profile.enabled}
                        onChange={(event) =>
                          saveProfile(profile.task, { enabled: event.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={profile.retrievalStrategy}
                        onChange={(event) =>
                          saveProfile(profile.task, {
                            retrievalStrategy: event.target.value,
                          })
                        }
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      >
                        <option value="hybrid">hybrid</option>
                        <option value="vector">vector</option>
                        <option value="keyword">keyword</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={profile.topK}
                        onChange={(event) =>
                          saveProfile(profile.task, { topK: Number(event.target.value) })
                        }
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={profile.maxContextChunks}
                        onChange={(event) =>
                          saveProfile(profile.task, {
                            maxContextChunks: Number(event.target.value),
                          })
                        }
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={profile.minSimilarity}
                        onChange={(event) =>
                          saveProfile(profile.task, {
                            minSimilarity: Number(event.target.value),
                          })
                        }
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 p-5">
          <h2 className="mb-3 text-lg font-medium">RAG Playground</h2>
          <p className="mb-3 text-sm text-slate-400">
            Test retrieval against the effective configuration without changing
            any project data.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Test question, e.g. How is authentication handled?"
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
            <button
              type="button"
              disabled={busy}
              onClick={runTestQuery}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Running..." : "Test retrieval"}
            </button>
          </div>
          {testLatency !== null && (
            <p className="mt-3 text-xs text-slate-500">
              Retrieval latency: {testLatency} ms · {testResults.length} result(s)
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {testResults.map((result, index) => (
              <li
                key={`${result.uri}-${index}`}
                className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-200">
                  [{index + 1}] {result.sourceName}
                  {result.path ? ` · ${result.path}` : ""}
                </div>
                <div className="mt-1 line-clamp-3 text-slate-400">
                  {result.excerpt}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
