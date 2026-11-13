import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exchangeGitHubOAuthCode,
  fetchGitHubJson,
} from "../../src/server/github-http.js";

type HttpTransport = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

test("retries a transient GitHub API connection failure", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return Response.json({ login: "test-user" });
  };

  const result = await fetchGitHubJson<{ login: string }>(
    "/user",
    { headers: { Authorization: "Bearer test-token" } },
    transport,
  );

  assert.equal(result.login, "test-user");
  assert.equal(calls, 2);
});

test("does not retry GitHub API authentication errors", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    return new Response("", { status: 401 });
  };

  await assert.rejects(
    fetchGitHubJson(
      "/user",
      { headers: { Authorization: "Bearer test-token" } },
      transport,
    ),
    /GitHub rejected the saved authorization \(HTTP 401\).*sign in again/,
  );
  assert.equal(calls, 1);
});

test("reports a useful error after repeated connection failures", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    fetchGitHubJson(
      "/user",
      { headers: { Authorization: "Bearer test-token" } },
      transport,
    ),
    /Could not connect to GitHub API \(\/user\) after 3 attempts.*api\.github\.com/,
  );
  assert.equal(calls, 3);
});

test("does not expose raw fetch failures after GitHub read retries", async () => {
  const transport: HttpTransport = async () => {
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    fetchGitHubJson("/user/repos", {}, transport),
    (cause: unknown) => {
      assert.ok(cause instanceof Error);
      assert.match(cause.message, /Could not connect to GitHub API/);
      assert.notEqual(cause.message, "fetch failed");
      return true;
    },
  );
});

test("does not retry GitHub API writes after an uncertain network failure", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    fetchGitHubJson(
      "/user/repos",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: JSON.stringify({ name: "test-repository" }),
      },
      transport,
    ),
    /Could not complete the GitHub API request.*verify the action in GitHub/,
  );
  assert.equal(calls, 1);
});

test("retries transient GitHub API server errors for safe reads", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    if (calls === 1) return new Response("", { status: 503 });
    return Response.json([{ id: 1 }]);
  };

  const result = await fetchGitHubJson<Array<{ id: number }>>(
    "/user/repos",
    {},
    transport,
  );

  assert.deepEqual(result, [{ id: 1 }]);
  assert.equal(calls, 2);
});

test("retries a transient GitHub OAuth token connection failure", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return Response.json({ access_token: "test-token" });
  };

  const token = await exchangeGitHubOAuthCode(
    "one-time-code",
    { clientId: "client-id", clientSecret: "client-secret" },
    transport,
  );

  assert.equal(token, "test-token");
  assert.equal(calls, 2);
});

test("returns actionable guidance when GitHub OAuth remains unreachable", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    exchangeGitHubOAuthCode(
      "one-time-code",
      { clientId: "client-id", clientSecret: "client-secret" },
      transport,
    ),
    /Could not connect to GitHub's OAuth service after 3 attempts.*github\.com/,
  );
  assert.equal(calls, 3);
});

test("does not retry a rejected GitHub OAuth code", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    return Response.json({ error: "bad_verification_code" });
  };

  await assert.rejects(
    exchangeGitHubOAuthCode(
      "used-code",
      { clientId: "client-id", clientSecret: "client-secret" },
      transport,
    ),
    /GitHub token exchange failed.*bad_verification_code/,
  );
  assert.equal(calls, 1);
});
