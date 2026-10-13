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
  requestTimeoutMs?: number;
  maxConsecutivePollErrors?: number;
  onSuccess?: (run: GenerationRun) => void;
  onFailure?: (message: string) => void;
}

const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_MAX_POLL_DURATION = 15 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT = 12 * 1000;
const DEFAULT_MAX_CONSECUTIVE_POLL_ERRORS = 5;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class RequestTimeoutError extends Error {
  constructor() {
    super("The status request timed out.");
    this.name = "RequestTimeoutError";
  }
}

class PollingTimeoutError extends Error {
  constructor() {
    super(
      "Status checking timed out. The operation may still be running on the server. Check the existing run before retrying.",
    );
    this.name = "PollingTimeoutError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: Record<string, unknown> = {};

  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      } else {
        body = { message: text };
      }
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
      throw new ApiError(
        `${message} An existing project operation may still be running; check its status before retrying.`,
        response.status,
      );
    }

    if (response.status === 401) {
      throw new ApiError(
        "Your session may have expired. Please sign in again.",
        response.status,
      );
    }

    throw new ApiError(message, response.status);
  }

  return body as T;
}

/**
 * A timeout for one HTTP request. Timing out this request does not abort the
 * parent generation operation, so polling can retry temporary slow responses.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  parentSignal: AbortSignal,
  timeoutMs: number,
): Promise<Response> {
  if (parentSignal.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }

  const requestController = new AbortController();
  let timedOut = false;

  const abortFromParent = () => requestController.abort();
  parentSignal.addEventListener("abort", abortFromParent, { once: true });

  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: requestController.signal,
    });
  } catch (cause: unknown) {
    if (parentSignal.aborted) {
      throw new DOMException("Request aborted", "AbortError");
    }

    if (timedOut) {
      throw new RequestTimeoutError();
    }

    throw cause;
  } finally {
    window.clearTimeout(timeout);
    parentSignal.removeEventListener("abort", abortFromParent);
  }
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

function isRetryablePollError(cause: unknown): boolean {
  if (cause instanceof RequestTimeoutError) return true;
  if (cause instanceof TypeError) return true; // Usually a temporary network failure.
  if (cause instanceof ApiError) {
    return cause.status === 408 || cause.status === 425 || cause.status === 429 || cause.status >= 500;
  }
  return false;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "An unexpected generation error occurred.";
}

export function useProjectGeneration(options: Options = {}) {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL,
    maxPollDurationMs = DEFAULT_MAX_POLL_DURATION,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT,
    maxConsecutivePollErrors = DEFAULT_MAX_CONSECUTIVE_POLL_ERRORS,
    onSuccess,
    onFailure,
  } = options;

  const [status, setStatus] = useState<GenerationStatus>("IDLE");
  const [operation, setOperation] = useState<"generate" | "review" | null>(null);
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
      activeRef.current = false;
    };
  }, []);

  const updateStatus = useCallback((value: GenerationStatus) => {
    if (mountedRef.current) setStatus(value);
  }, []);

  const updateError = useCallback((value: string | null) => {
    if (mountedRef.current) setError(value);
  }, []);

  const updateRunId = useCallback((value: string | null) => {
    if (mountedRef.current) setRunId(value);
  }, []);

  const pollRun = useCallback(
    async (
      projectId: string,
      id: string,
      signal: AbortSignal,
    ): Promise<GenerationRun> => {
      const startedAt = Date.now();
      let consecutiveErrors = 0;

      while (!signal.aborted) {
        if (Date.now() - startedAt >= maxPollDurationMs) {
          throw new PollingTimeoutError();
        }

        try {
          const response = await fetchWithTimeout(
            `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(id)}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" },
            },
            signal,
            requestTimeoutMs,
          );

          const data = await parseResponse<ApiResponse>(response);
          const run = data.run;

          if (!run || typeof run.status !== "string") {
            throw new Error("The server returned an invalid run-status response.");
          }

          consecutiveErrors = 0;
          const current = run.status.toUpperCase();

          if (["SUCCESS", "COMPLETED", "SUCCEEDED"].includes(current)) {
            return run;
          }

          if (["FAILED", "ERROR", "CANCELLED"].includes(current)) {
            throw new Error(run.error || data.message || "Project operation failed.");
          }

          updateStatus("RUNNING");
          await waitForNextPoll(pollIntervalMs, signal);
        } catch (cause: unknown) {
          if (signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
            throw new DOMException("Request aborted", "AbortError");
          }

          if (!isRetryablePollError(cause)) throw cause;

          consecutiveErrors += 1;
          if (consecutiveErrors > maxConsecutivePollErrors) {
            throw new Error(
              `Unable to check project status after ${maxConsecutivePollErrors} retries. ${errorMessage(cause)} The operation may still be running; check run ${id} before retrying.`,
            );
          }

          const backoff = Math.min(pollIntervalMs * 2 ** (consecutiveErrors - 1), 10_000);
          await waitForNextPoll(backoff, signal);
        }
      }

      throw new DOMException("Request aborted", "AbortError");
    },
    [maxConsecutivePollErrors, maxPollDurationMs, pollIntervalMs, requestTimeoutMs, updateStatus],
  );

  const generate = useCallback(
    async (
      projectId: string,
      prompt: string,
      provider = "OPENROUTER",
      operation: "generate" | "review" = "generate",
    ): Promise<GenerationRun | null> => {
      if (activeRef.current) {
        updateError("Another project operation is already active in this page.");
        return null;
      }

      if (!projectId.trim()) {
        updateError("Project ID is required.");
        return null;
      }

      if (operation === "generate" && !prompt.trim()) {
        updateError("Please enter a project description.");
        return null;
      }

      const controller = new AbortController();
      activeRef.current = true;
      controllerRef.current = controller;
      updateError(null);
      updateStatus("STARTING");
      setOperation(operation);
      updateRunId(null);

      try {
        const response = await fetchWithTimeout(
          `/api/projects/${encodeURIComponent(projectId)}/${operation}`,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(
              operation === "generate"
                ? { prompt: prompt.trim(), provider }
                : {},
            ),
          },
          controller.signal,
          Math.max(requestTimeoutMs * 2, 20_000),
        );

        const data = await parseResponse<ApiResponse>(response);

        if (response.status !== 202) {
          throw new Error(
            `The server did not return HTTP 202 for the queued ${operation} job.`,
          );
        }

        if (!data.run?.id) {
          throw new Error(
            `The server accepted the ${operation} request but did not return a run ID. Check project/run status before retrying.`,
          );
        }

        const id = data.run.id;
        updateRunId(id);
        updateStatus("RUNNING");

        const completedRun = await pollRun(projectId, id, controller.signal);
        updateStatus("SUCCESS");
        onSuccess?.(completedRun);
        return completedRun;
      } catch (cause: unknown) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return null;
        }

        const message =
          cause instanceof RequestTimeoutError
            ? `The ${operation} request timed out before the server confirmed the run. The server may still have accepted it; check the project/run status before retrying.`
            : errorMessage(cause);

        updateError(message);
        updateStatus("FAILED");
        onFailure?.(message);
        return null;
      } finally {
        activeRef.current = false;
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [onFailure, onSuccess, pollRun, requestTimeoutMs, updateError, updateRunId, updateStatus],
  );

  const review = useCallback(
    (projectId: string) => generate(projectId, "", "OPENROUTER", "review"),
    [generate],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    activeRef.current = false;
    updateError(null);
    updateStatus("IDLE");
    setOperation(null);
    updateRunId(null);
  }, [updateError, updateRunId, updateStatus]);

  return {
    status,
    operation,
    runId,
    error,
    isBusy: status === "STARTING" || status === "RUNNING",
    generate,
    review,
    reset,
  };
}
