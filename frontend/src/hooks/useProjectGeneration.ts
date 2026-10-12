
import { useCallback, useEffect, useRef, useState } from "react";

export type GenerationStatus =
  | "IDLE"
  | "STARTING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED";

interface GenerationRun {
  id: string;
  status: string;
  operation?: string;
  error?: string | null;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  run?: GenerationRun;
  project?: {
    id: string;
    status?: string;
  };
}

interface Options {
  pollIntervalMs?: number;
  maxPollDurationMs?: number;
  onSuccess?: (run: GenerationRun) => void;
  onFailure?: (message: string) => void;
}

const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_MAX_POLL_DURATION = 15 * 60 * 1000;

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let body: Record<string, unknown> = {};

  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `Request failed with HTTP ${response.status}.`;

    if (response.status === 409) {
      throw new Error(
        `${message} Check the existing generation run before retrying.`,
      );
    }

    if (response.status === 401) {
      throw new Error("Your session may have expired. Please sign in again.");
    }

    throw new Error(message);
  }

  return body as T;
}

function waitForNextPoll(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);

    const abort = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Request aborted", "AbortError"));
    };

    signal.addEventListener("abort", abort, { once: true });
  });
}

export function useProjectGeneration(options: Options = {}) {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL,
    maxPollDurationMs = DEFAULT_MAX_POLL_DURATION,
    onSuccess,
    onFailure,
  } = options;

  const [status, setStatus] = useState<GenerationStatus>("IDLE");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const mountedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const updateStatus = useCallback((value: GenerationStatus) => {
    if (mountedRef.current) {
      setStatus(value);
    }
  }, []);

  const updateError = useCallback((value: string | null) => {
    if (mountedRef.current) {
      setError(value);
    }
  }, []);

  const pollRun = useCallback(
    async (
      projectId: string,
      id: string,
      signal: AbortSignal,
    ): Promise<GenerationRun> => {
      const startedAt = Date.now();

      while (!signal.aborted) {
        if (Date.now() - startedAt >= maxPollDurationMs) {
          throw new Error(
            "Polling timed out. Generation may still be running on the server. Check the run status before retrying.",
          );
        }

        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(id)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal,
          },
        );

        const data = await parseResponse<ApiResponse>(response);
        const run = data.run;

        if (!run || typeof run.status !== "string") {
          throw new Error("The server returned an invalid run-status response.");
        }

        const current = run.status.toUpperCase();

        if (current === "SUCCESS" || current === "COMPLETED") {
          return run;
        }

        if (
          current === "FAILED" ||
          current === "ERROR" ||
          current === "CANCELLED"
        ) {
          throw new Error(run.error || data.message || "Generation failed.");
        }

        updateStatus("RUNNING");
        await waitForNextPoll(pollIntervalMs, signal);
      }

      throw new DOMException("Request aborted", "AbortError");
    },
    [maxPollDurationMs, pollIntervalMs, updateStatus],
  );

  const generate = useCallback(
    async (
      projectId: string,
      prompt: string,
      provider = "OPENROUTER",
    ): Promise<GenerationRun | null> => {
      if (activeRef.current) {
        updateError("A generation request is already active in this page.");
        return null;
      }

      if (!projectId.trim()) {
        updateError("Project ID is required.");
        return null;
      }

      if (!prompt.trim()) {
        updateError("Please enter a project description.");
        return null;
      }

      const controller = new AbortController();

      activeRef.current = true;
      controllerRef.current = controller;

      updateError(null);
      updateStatus("STARTING");

      if (mountedRef.current) {
        setRunId(null);
      }

      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/generate`,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              provider,
            }),
            signal: controller.signal,
          },
        );

        const data = await parseResponse<ApiResponse>(response);

        if (response.status !== 202) {
          throw new Error(
            "The server did not return HTTP 202 for the queued generation job.",
          );
        }

        if (!data.run?.id) {
          throw new Error(
            "The server accepted the request but did not return a run ID. Check the project status before retrying.",
          );
        }

        const id = data.run.id;

        if (mountedRef.current) {
          setRunId(id);
        }

        updateStatus("RUNNING");

        const completedRun = await pollRun(
          projectId,
          id,
          controller.signal,
        );

        updateStatus("SUCCESS");
        onSuccess?.(completedRun);

        return completedRun;
      } catch (cause: unknown) {
        if (
          cause instanceof DOMException &&
          cause.name === "AbortError"
        ) {
          return null;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : "An unexpected generation error occurred.";

        updateError(message);
        updateStatus("FAILED");
        onFailure?.(message);

        return null;
      } finally {
        activeRef.current = false;

        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [onFailure, onSuccess, pollRun, updateError, updateStatus],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    activeRef.current = false;

    updateError(null);
    updateStatus("IDLE");

    if (mountedRef.current) {
      setRunId(null);
    }
  }, [updateError, updateStatus]);

  return {
    status,
    runId,
    error,
    isBusy: status === "STARTING" || status === "RUNNING",
    generate,
    reset,
  };
}