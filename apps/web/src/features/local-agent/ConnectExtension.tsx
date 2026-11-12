import { useEffect, useState } from "react";
import { api, type User } from "../../api";

/**
 * /connect page opened by the VS Code extension. It shows the pairing code,
 * signs the user in with GitHub if needed, and approves the pairing so the
 * extension receives its session automatically — no cookie copying.
 */
export function ConnectExtension({
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
            Connect VS Code to Codevia AI
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with GitHub first. Codevia AI will then connect VS Code
            automatically.
          </p>
          <button
            type="button"
            onClick={() =>
              api.login(`${window.location.pathname}${window.location.search}`)
            }
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
        <h1 className="text-2xl font-semibold">Connect VS Code to Codevia AI</h1>
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
