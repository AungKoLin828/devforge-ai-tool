const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getWorkspaceKey,
  hasCompatibleWorkspaceEmbedding,
  hashWorkspaceContent,
  isEligibleWorkspacePath,
} = require("../out/workspaceIndex.js");

test("excludes secrets, dependency folders, and unsupported binaries", () => {
  for (const path of [
    ".env",
    ".env.test",
    "config/credentials.json",
    "keys/private-key.pem",
    "node_modules/library/index.ts",
    "dist/app.js",
    "image.png",
  ]) {
    assert.equal(isEligibleWorkspacePath(path), false, path);
  }
});

test("allows supported source and documentation files", () => {
  for (const path of ["src/app.ts", "docs/guide.md", "main.py"]) {
    assert.equal(isEligibleWorkspacePath(path), true, path);
  }
});

test("applies custom glob exclusions", () => {
  assert.equal(
    isEligibleWorkspacePath("src/generated/client.ts", ["src/generated/**"]),
    false,
  );
  assert.equal(
    isEligibleWorkspacePath("src/app.ts", ["src/generated/**"]),
    true,
  );
});

test("workspace identifiers do not expose their source path", () => {
  const key = getWorkspaceKey("file:///private/project");
  assert.match(key, /^[a-f0-9]{12}$/);
  assert.notEqual(key, getWorkspaceKey("file:///private/other"));
  assert.equal(hashWorkspaceContent("same"), hashWorkspaceContent("same"));
  assert.notEqual(hashWorkspaceContent("one"), hashWorkspaceContent("two"));
});

test("re-indexes unchanged files when their embedding provider or model changes", () => {
  const source = {
    embeddingProvider: "OPENROUTER",
    embeddingModel: "openai/text-embedding-3-small",
  };
  assert.equal(
    hasCompatibleWorkspaceEmbedding(
      source,
      "OPENROUTER",
      "openai/text-embedding-3-small",
    ),
    true,
  );
  assert.equal(
    hasCompatibleWorkspaceEmbedding(
      source,
      "OPENAI",
      "text-embedding-3-small",
    ),
    false,
  );
  assert.equal(
    hasCompatibleWorkspaceEmbedding(source, "OPENROUTER", "changed-model"),
    false,
  );
});
