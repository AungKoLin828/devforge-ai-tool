import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableProviderStatus } from "../../packages/ai-engine/provider-routing.js";

test("allows a configured fallback only for transient provider failures", () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableProviderStatus(status), true, String(status));
  }
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(isRetryableProviderStatus(status), false, String(status));
  }
});
