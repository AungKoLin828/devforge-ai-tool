import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchGitHubJson } from "../../src/server/github-http.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("retries a transient GitHub API connection failure", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return new Response(JSON.stringify({ login: "test-user" }), {
      status: 200,
    });
  };

  const result = await fetchGitHubJson<{ login: string }>("/user", {
    headers: { Authorization: "Bearer test-token" },
  });

  assert.equal(result.login, "test-user");
  assert.equal(calls, 2);
});

test("does not retry GitHub API authentication errors", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("", { status: 401 });
  };

  await assert.rejects(
    fetchGitHubJson("/user", { headers: { Authorization: "Bearer test-token" } }),
    /GitHub API request failed \(\/user, HTTP 401\)/,
  );
  assert.equal(calls, 1);
});

test("reports a useful error after repeated connection failures", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    fetchGitHubJson("/user", { headers: { Authorization: "Bearer test-token" } }),
    /Could not connect to GitHub API \(\/user\) after 3 attempts.*api\.github\.com/,
  );
  assert.equal(calls, 3);
});
