import test from "node:test";
import assert from "node:assert/strict";
import { handleApi } from "../../src/server/router.js";

// GET /api/health is public and reports database and provider status.
test("health endpoint reports status without authentication", async () => {
  const res = await handleApi(
    new Request("http://localhost/api/health", { method: "GET" }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    success: boolean;
    status: string;
    database: string;
    providers: Array<{ provider: string; envConfigured: boolean }>;
  };
  assert.equal(body.success, true);
  assert.ok(["ok", "degraded"].includes(body.status));
  assert.ok(["ok"].includes(body.database) || body.database.startsWith("unreachable"));
  assert.ok(Array.isArray(body.providers));
  assert.ok(body.providers.some((p) => p.provider === "OPENROUTER"));
});
