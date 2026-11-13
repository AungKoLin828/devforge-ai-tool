import { request as httpsRequest } from "node:https";

const API_ORIGIN = "https://api.github.com";
const OAUTH_ORIGIN = "https://github.com/login/oauth/access_token";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

type HttpTransport = (input: string, init: RequestInit) => Promise<Response>;

/** Use Node's TLS transport for GitHub requests; unlike undici fetch, it works on hosts that reset its TLS connections. */
const requestGitHubOverHttps: HttpTransport = (input, init) =>
  new Promise((resolve, reject) => {
    const url = new URL(input);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const request = httpsRequest(
      url,
      {
        method: init.method || "GET",
        headers,
        family: 4,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        response.on("error", reject);
        response.on("end", () => {
          const status = response.statusCode || 500;
          const body = [204, 205, 304].includes(status)
            ? null
            : Buffer.concat(chunks);
          resolve(
            new Response(body, {
              status,
              headers: response.headers as HeadersInit,
            }),
          );
        });
      },
    );
    request.setTimeout(10000, () =>
      request.destroy(new Error("GitHub request timed out.")),
    );
    if (init.signal) {
      if (init.signal.aborted) {
        request.destroy(new Error("GitHub request was aborted."));
      } else {
        init.signal.addEventListener(
          "abort",
          () => request.destroy(new Error("GitHub request was aborted.")),
          { once: true },
        );
      }
    }
    request.on("error", reject);
    if (typeof init.body === "string" || Buffer.isBuffer(init.body)) {
      request.end(init.body);
    } else if (init.body instanceof Uint8Array) {
      request.end(Buffer.from(init.body));
    } else {
      request.end();
    }
  });

/** Fetch a GitHub API resource, retrying transient failures on safe GET requests. */
export async function fetchGitHubJson<T>(
  path: string,
  init: RequestInit,
  transport: HttpTransport = requestGitHubOverHttps,
): Promise<T> {
  let lastError: unknown;
  const method = (init.method || "GET").toUpperCase();
  const retrySafe = method === "GET";
  const maxAttempts = retrySafe ? MAX_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      const headers = new Headers({
        Accept: "application/vnd.github+json",
        "User-Agent": "CodeviaAI",
        "X-GitHub-Api-Version": "2022-11-28",
      });
      new Headers(init.headers).forEach((value, key) =>
        headers.set(key, value),
      );
      response = await transport(`${API_ORIGIN}${path}`, {
        ...init,
        redirect: "error",
        headers,
        signal: AbortSignal.timeout(10000),
      });
    } catch (cause) {
      lastError = cause;
      if (attempt < maxAttempts) await delay(attempt * 250);
      continue;
    }

    if (!response.ok) {
      if (
        retrySafe &&
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < maxAttempts
      ) {
        await delay(attempt * 250);
        continue;
      }
      if (response.status === 401) {
        throw new Error(
          "GitHub rejected the saved authorization (HTTP 401). Sign out of Codevia AI and sign in again to reconnect your GitHub account.",
        );
      }
      if (response.status === 403) {
        throw new Error(
          "GitHub denied this request (HTTP 403). Check your repository access and OAuth app permissions.",
        );
      }
      throw new Error(
        `GitHub API request failed (${path}, HTTP ${response.status})`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new Error(`GitHub returned an invalid response for ${path}.`);
    }
  }

  if (!retrySafe) {
    throw new Error(
      `Could not complete the GitHub API request (${path}) because the connection failed. Check outbound HTTPS access to api.github.com and verify the action in GitHub before retrying.`,
      { cause: lastError },
    );
  }
  throw new Error(
    `Could not connect to GitHub API (${path}) after ${MAX_ATTEMPTS} attempts. Check outbound HTTPS access to api.github.com and retry sign-in.`,
    { cause: lastError },
  );
}

/** Exchange an OAuth code, retrying only failed network attempts. */
export async function exchangeGitHubOAuthCode(
  code: string,
  config: { clientId: string; clientSecret: string },
  transport: HttpTransport = requestGitHubOverHttps,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await transport(OAUTH_ORIGIN, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (cause) {
      lastError = cause;
      if (attempt < MAX_ATTEMPTS) await delay(attempt * 250);
      continue;
    }

    const result = (await response.json().catch(() => ({}))) as {
      access_token?: unknown;
      error?: unknown;
    };
    if (
      !response.ok ||
      typeof result.access_token !== "string" ||
      !result.access_token
    ) {
      throw new Error(
        `GitHub token exchange failed${typeof result.error === "string" ? ` (${result.error})` : ""}. Verify the OAuth app credentials and callback URL, then start sign-in again.`,
      );
    }
    return result.access_token;
  }

  throw new Error(
    "Could not connect to GitHub's OAuth service after 3 attempts. Check outbound HTTPS access to github.com, then start sign-in again.",
    { cause: lastError },
  );
}
