import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffectiveRagSettings,
  updateRagSettings,
} from "../../src/server/rag-config.js";

// Server-side validation clamps out-of-range admin values instead of trusting the client.
test("updateRagSettings clamps invalid values and records defaults", async () => {
  const updated = await updateRagSettings(
    {
      retrievalStrategy: "bogus",
      retrievalStrategyTopK: 99999,
      minSimilarity: 42,
      maxContextChunks: -3,
      noResultBehavior: "explode",
    },
    "test-admin",
  );
  assert.equal(updated.retrievalStrategy, "hybrid");
  assert.ok(updated.retrievalStrategyTopK <= 100);
  assert.ok(updated.minSimilarity >= 0 && updated.minSimilarity <= 1);
  assert.ok(updated.maxContextChunks >= 1);
  assert.equal(updated.noResultBehavior, "fallback");
});

// Unknown settings keys are rejected so the singleton cannot be polluted.
test("updateRagSettings rejects unknown settings", async () => {
  await assert.rejects(
    () => updateRagSettings({ notARealSetting: true }, "test-admin"),
    /Unknown RAG settings/,
  );
});

// Effective settings with task profile overrides.
test("getEffectiveRagSettings returns bounded defaults for chat", async () => {
  const config = await getEffectiveRagSettings("chat");
  assert.equal(typeof config.enabled, "boolean");
  assert.ok(["hybrid", "vector", "keyword"].includes(config.retrievalStrategy));
  assert.ok(config.topK >= 1 && config.topK <= 100);
  assert.ok(config.maxContextChunks >= 1 && config.maxContextChunks <= 40);
  assert.ok(config.maxContextTokens >= 500 && config.maxContextTokens <= 32000);
});
