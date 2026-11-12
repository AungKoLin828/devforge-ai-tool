import assert from "node:assert/strict";
import test from "node:test";
import { chunkFiles } from "../../packages/rag-engine/chunking.js";
import {
  cosineSimilarity,
  reciprocalRankFusion,
} from "../../packages/rag-engine/retrieval.js";
import { fetchPublicText } from "../../src/server/knowledge-fetch.js";

test("chunks long files with source paths and bounded overlapping sections", () => {
  const content = `${"first paragraph ".repeat(100)}\n${"second paragraph ".repeat(100)}`;
  const chunks = chunkFiles([{ path: "docs/guide.md", content }]);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.length <= 1800));
  assert.ok(chunks.every((chunk) => chunk.metadata.path === "docs/guide.md"));
  assert.ok(chunks[0].content.slice(-180).trim());
});

test("returns no chunks for whitespace-only files", () => {
  assert.deepEqual(chunkFiles([{ path: "empty.txt", content: " \r\n " }]), []);
});

test("calculates cosine similarity and rejects mismatched dimensions", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [1]), 0);
});

test("combines lexical and semantic ranks without duplicating citations", () => {
  const lexical = [
    { item: { id: "shared" }, rank: 1 },
    { item: { id: "text" }, rank: 2 },
  ];
  const semantic = [
    { item: { id: "shared" }, rank: 1 },
    { item: { id: "vector" }, rank: 2 },
  ];

  assert.deepEqual(
    reciprocalRankFusion(lexical, semantic, 3).map((item) => item.id),
    ["shared", "text", "vector"],
  );
});

test("refuses non-HTTPS and literal-IP URL imports before making requests", async () => {
  await assert.rejects(fetchPublicText("http://example.com"), /HTTPS/);
  await assert.rejects(fetchPublicText("https://127.0.0.1/"), /public DNS hostname/);
});
