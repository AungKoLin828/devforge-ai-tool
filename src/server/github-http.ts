const API_ORIGIN = "https://api.github.com";
const MAX_ATTEMPTS = 3;

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Fetch a GitHub API resource, retrying transient failures on safe GET requests. */
export async function fetchGitHubJson<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
      response = await fetch(`${API_ORIGIN}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10000),
      });
    } catch (cause) {
      lastError = cause;
      if (attempt < MAX_ATTEMPTS) await delay(attempt * 250);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed (${path}, HTTP ${response.status})`,
      );
    }

    return (await response.json()) as T;
  }

  throw new Error(
    `Could not connect to GitHub API (${path}) after ${MAX_ATTEMPTS} attempts. Check outbound HTTPS access to api.github.com and retry sign-in.`,
    { cause: lastError },
  );
}
