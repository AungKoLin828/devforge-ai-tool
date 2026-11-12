import { Prisma } from "../generated/prisma/client.js";
import { chunkFiles, type KnowledgeFile } from "../../packages/rag-engine/chunking.js";
import {
  cosineSimilarity,
  reciprocalRankFusion,
  type RankedKnowledge,
} from "../../packages/rag-engine/retrieval.js";
import {
  embed,
  embeddingModel,
  type Provider,
} from "./ai.js";
import { fetchGitHubKnowledgeFiles } from "./github.js";
import { fetchPublicText } from "./knowledge-fetch.js";
import { prisma } from "./db.js";
import { owner } from "./project-access.js";

const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_SOURCE_CHUNKS = 180;
const MAX_PROJECT_CHUNKS = 5000;
const EXCLUDED_PROJECT_PATH =
  /(^|\/)(?:\.git|\.next|\.nuxt|\.venv|build|coverage|dist|node_modules|out|target|vendor)(\/|$)|(^|\/)\.env(?:$|\.(?:local|production|development|secret))|(?:^|\/)(?:id_rsa|id_ed25519|credentials|secrets?)(?:\.|$)|\.(?:pem|p12|pfx|key)$/i;

export class RagInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RagInputError";
  }
}

export type RagCitation = {
  id: string;
  sourceName: string;
  uri: string;
  excerpt: string;
  path?: string;
};

function assertTextSize(text: string, label: string) {
  if (Buffer.byteLength(text, "utf8") > MAX_SOURCE_BYTES) {
    throw new RagInputError(`${label} exceeds the 512 KB import limit.`);
  }
}

function normalizeFiles(files: KnowledgeFile[]) {
  const normalizedFiles = files.map((file) => ({
    path: file.path
      .replaceAll("\\", "/")
      .replace(/[\u0000-\u001f]/g, " ")
      .slice(0, 512),
    content: file.content,
  }));
  const cleanFiles = normalizedFiles
    .filter(
      (file) =>
        file.path &&
        !EXCLUDED_PROJECT_PATH.test(file.path) &&
        typeof file.content === "string" &&
        file.content.trim() &&
        !file.content.includes("\0"),
    );
  if (cleanFiles.length > 100) {
    throw new RagInputError("Knowledge source is limited to 100 text files.");
  }
  const seenPaths = new Set<string>();
  const uniqueFiles = cleanFiles.filter((file) => {
    const path = file.path;
    if (seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
  let totalBytes = 0;
  for (const file of uniqueFiles) {
    totalBytes += Buffer.byteLength(file.content, "utf8");
    if (totalBytes > MAX_SOURCE_BYTES) {
      throw new RagInputError("Knowledge source exceeds the 512 KB import limit.");
    }
  }
  return uniqueFiles;
}

async function saveKnowledgeSource(input: {
  projectId: string;
  userId: string;
  kind: "DOCUMENT" | "URL" | "GITHUB" | "PROJECT";
  name: string;
  uri: string;
  files: KnowledgeFile[];
  provider: Provider;
}) {
  const files = normalizeFiles(input.files);
  if (!files.length) {
    throw new RagInputError("Knowledge source contains no supported text files.");
  }

  const chunks = chunkFiles(files);
  if (!chunks.length) {
    throw new RagInputError("Knowledge source did not contain readable text.");
  }
  if (chunks.length > MAX_SOURCE_CHUNKS) {
    throw new RagInputError(
      `Knowledge source creates ${chunks.length} chunks; reduce it to ${MAX_SOURCE_CHUNKS} chunks or fewer.`,
    );
  }

  const existingSource = await prisma.knowledgeSource.findUnique({
    where: {
      projectId_uri: { projectId: input.projectId, uri: input.uri },
    },
    select: { id: true },
  });
  const existingChunks = existingSource
    ? await prisma.knowledgeChunk.count({
        where: { sourceId: existingSource.id },
      })
    : 0;
  const projectChunks = await prisma.knowledgeChunk.count({
    where: { projectId: input.projectId },
  });
  if (projectChunks - existingChunks + chunks.length > MAX_PROJECT_CHUNKS) {
    throw new RagInputError(
      `Project knowledge is limited to ${MAX_PROJECT_CHUNKS} chunks. Remove a source before adding more.`,
    );
  }

  const vectors: number[][] = [];
  const batches: string[][] = [];
  for (let index = 0; index < chunks.length; index += 32) {
    batches.push(chunks.slice(index, index + 32).map((chunk) => chunk.content));
  }
  for (let index = 0; index < batches.length; index += 3) {
    const embeddedBatches = await Promise.all(
      batches
        .slice(index, index + 3)
        .map((batch) => embed(batch, input.provider, input.userId)),
    );
    for (const batch of embeddedBatches) vectors.push(...batch);
  }

  return prisma.$transaction(async (tx) => {
    const currentProjectChunks = await tx.knowledgeChunk.count({
      where: { projectId: input.projectId },
    });
    const currentSource = await tx.knowledgeSource.findUnique({
      where: {
        projectId_uri: { projectId: input.projectId, uri: input.uri },
      },
      select: { id: true },
    });
    const currentSourceChunks = currentSource
      ? await tx.knowledgeChunk.count({
          where: { sourceId: currentSource.id },
        })
      : 0;
    if (
      currentProjectChunks - currentSourceChunks + chunks.length >
      MAX_PROJECT_CHUNKS
    ) {
      throw new RagInputError(
        `Project knowledge is limited to ${MAX_PROJECT_CHUNKS} chunks. Remove a source before adding more.`,
      );
    }

    const source = await tx.knowledgeSource.upsert({
      where: {
        projectId_uri: { projectId: input.projectId, uri: input.uri },
      },
      create: {
        projectId: input.projectId,
        kind: input.kind,
        embeddingProvider: input.provider,
        embeddingModel: embeddingModel(input.provider),
        name: input.name.slice(0, 200),
        uri: input.uri,
      },
      update: {
        kind: input.kind,
        embeddingProvider: input.provider,
        embeddingModel: embeddingModel(input.provider),
        name: input.name.slice(0, 200),
        lastIndexedAt: new Date(),
      },
    });

    await tx.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        projectId: input.projectId,
        sourceId: source.id,
        content: chunk.content,
        embedding: vectors[index],
        metadata: chunk.metadata,
      })),
    });

    return {
      id: source.id,
      kind: source.kind,
      embeddingProvider: source.embeddingProvider,
      embeddingModel: source.embeddingModel,
      name: source.name,
      uri: source.uri,
      createdAt: source.createdAt,
      lastIndexedAt: source.lastIndexedAt,
      chunkCount: chunks.length,
    };
  });
}

export async function listKnowledgeSources(projectId: string, userId: string) {
  await owner(projectId, userId);
  const sources = await prisma.knowledgeSource.findMany({
    where: { projectId },
    orderBy: { lastIndexedAt: "desc" },
    select: {
      id: true,
      kind: true,
      embeddingProvider: true,
      embeddingModel: true,
      name: true,
      uri: true,
      createdAt: true,
      lastIndexedAt: true,
      _count: { select: { chunks: true } },
    },
  });
  return sources.map(({ _count, ...source }) => ({
    ...source,
    chunkCount: _count.chunks,
  }));
}

export async function addKnowledgeDocument(
  projectId: string,
  userId: string,
  input: { name: unknown; content: unknown; provider: Provider },
) {
  await owner(projectId, userId);
  if (typeof input.name !== "string") {
    throw new RagInputError("Document name must be between 1 and 200 characters.");
  }
  const name = input.name
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
  if (!name || name.length > 200) {
    throw new RagInputError("Document name must be between 1 and 200 characters.");
  }
  if (typeof input.content !== "string" || !input.content.trim()) {
    throw new RagInputError("Document content is required.");
  }
  assertTextSize(input.content, "Document");

  return saveKnowledgeSource({
    projectId,
    userId,
    kind: "DOCUMENT",
    name,
    uri: `document:${name.toLowerCase()}`,
    files: [{ path: name, content: input.content }],
    provider: input.provider,
  });
}

export async function addKnowledgeUrl(
  projectId: string,
  userId: string,
  input: { url: unknown; provider: Provider },
) {
  await owner(projectId, userId);
  if (typeof input.url !== "string" || input.url.length > 2048) {
    throw new RagInputError("Enter a public HTTPS URL of 2,048 characters or fewer.");
  }
  const text = await fetchPublicText(input.url.trim());
  const url = new URL(input.url.trim());
  url.search = "";
  url.hash = "";
  return saveKnowledgeSource({
    projectId,
    userId,
    kind: "URL",
    name: `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 200),
    uri: url.toString(),
    files: [{ path: url.pathname || url.hostname, content: text }],
    provider: input.provider,
  });
}

function parseGitHubRepositoryUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new RagInputError("Enter a valid GitHub repository URL.");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new RagInputError("Enter a valid GitHub repository URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new RagInputError("GitHub source must be an HTTPS github.com repository URL.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    parts.length < 2 ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(parts[0]) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]) ||
    parts[0] === "." ||
    parts[0] === ".." ||
    parts[1] === "." ||
    parts[1] === ".."
  ) {
    throw new RagInputError("GitHub source URL must identify an owner and repository.");
  }
  let branch: string | undefined;
  if (parts.length > 2) {
    if (parts[2] !== "tree" || parts.length < 4) {
      throw new RagInputError("Use a repository URL or a GitHub tree URL with a branch.");
    }
    branch = parts.slice(3).join("/");
  }
  return { owner: parts[0], repository: parts[1].replace(/\.git$/i, ""), branch };
}

export async function addKnowledgeGitHub(
  projectId: string,
  userId: string,
  input: { url: unknown; provider: Provider },
) {
  await owner(projectId, userId);
  const { owner: repositoryOwner, repository, branch } =
    parseGitHubRepositoryUrl(input.url);
  const snapshot = await fetchGitHubKnowledgeFiles(
    userId,
    repositoryOwner,
    repository,
    branch,
  );
  const branchPath = snapshot.branch
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const uri = `https://github.com/${encodeURIComponent(repositoryOwner)}/${encodeURIComponent(repository)}/tree/${branchPath}`;
  return saveKnowledgeSource({
    projectId,
    userId,
    kind: "GITHUB",
    name: `${repositoryOwner}/${repository} (${snapshot.branch})`,
    uri,
    files: snapshot.files,
    provider: input.provider,
  });
}

export async function indexProjectArtifacts(
  projectId: string,
  userId: string,
  provider: Provider,
) {
  await owner(projectId, userId);
  const artifact = await prisma.artifact.findFirst({
    where: { projectId, type: "CODE" },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (!Array.isArray(artifact?.content)) {
    throw new RagInputError("This project has no saved code files to index.");
  }

  const files = artifact.content
    .filter(
      (file): file is { path: string; content: string } =>
        file !== null &&
        file !== undefined &&
        typeof file === "object" &&
        !Array.isArray(file) &&
        typeof file.path === "string" &&
        typeof file.content === "string",
    )
    .map((file) => ({ path: file.path, content: file.content }));
  return saveKnowledgeSource({
    projectId,
    userId,
    kind: "PROJECT",
    name: "Saved project files",
    uri: "project:latest-code-artifact",
    files,
    provider,
  });
}

export async function deleteKnowledgeSource(
  projectId: string,
  sourceId: string,
  userId: string,
) {
  await owner(projectId, userId);
  const source = await prisma.knowledgeSource.findFirst({
    where: { id: sourceId, projectId },
    select: { id: true },
  });
  if (!source) throw new RagInputError("Knowledge source was not found.");
  await prisma.knowledgeSource.delete({ where: { id: source.id } });
}

type SearchChunk = {
  id: string;
  content: string;
  sourceName: string;
  sourceUri: string;
  metadata: Prisma.JsonValue | null;
};

function getChunkPath(metadata: Prisma.JsonValue | null) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    !("path" in metadata) ||
    typeof metadata.path !== "string"
  ) {
    return undefined;
  }
  return metadata.path;
}

function getVector(value: Prisma.JsonValue | null) {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item): item is number =>
        typeof item === "number" && Number.isFinite(item),
    )
  ) {
    return undefined;
  }
  return value;
}

export async function searchKnowledge(
  projectId: string,
  userId: string,
  queryValue: unknown,
  provider: Provider,
) {
  await owner(projectId, userId);
  if (typeof queryValue !== "string" || !queryValue.trim() || queryValue.length > 4000) {
    throw new RagInputError("Search query must be between 1 and 4,000 characters.");
  }
  const query = queryValue.trim();
  const sourceCount = await prisma.knowledgeSource.count({ where: { projectId } });
  if (!sourceCount) return { results: [] as RagCitation[] };

  const compatibleChunks = await prisma.knowledgeChunk.count({
    where: {
      projectId,
      source: {
        embeddingProvider: provider,
        embeddingModel: embeddingModel(provider),
      },
    },
  });
  const queryVector = compatibleChunks
    ? (await embed([query], provider, userId))[0]
    : undefined;
  const lexical = await prisma.$queryRaw<
    Array<SearchChunk & { textRank: number }>
  >(Prisma.sql`
    SELECT
      chunk."id",
      chunk."content",
      source."name" AS "sourceName",
      source."uri" AS "sourceUri",
      chunk."metadata",
      ts_rank_cd(
        to_tsvector('english', chunk."content"),
        plainto_tsquery('english', ${query})
      ) AS "textRank"
    FROM "KnowledgeChunk" AS chunk
    INNER JOIN "KnowledgeSource" AS source ON source."id" = chunk."sourceId"
    WHERE chunk."projectId" = ${projectId}
      AND to_tsvector('english', chunk."content")
        @@ plainto_tsquery('english', ${query})
    ORDER BY "textRank" DESC
    LIMIT 40
  `);
  const chunks = queryVector
    ? await prisma.knowledgeChunk.findMany({
    where: {
      projectId,
      source: {
        embeddingProvider: provider,
        embeddingModel: embeddingModel(provider),
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PROJECT_CHUNKS,
    select: {
      id: true,
      content: true,
      embedding: true,
      metadata: true,
      source: { select: { name: true, uri: true } },
    },
      })
    : [];

  const semantic = queryVector
    ? chunks
    .flatMap((chunk) => {
      const vector = getVector(chunk.embedding);
      if (!vector) return [];
      return [
        {
          item: {
            id: chunk.id,
            content: chunk.content,
            sourceName: chunk.source.name,
            sourceUri: chunk.source.uri,
            metadata: chunk.metadata,
          },
          score: cosineSimilarity(queryVector, vector),
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 40)
    : [];

  const lexicalRanked: RankedKnowledge<SearchChunk>[] = lexical.map(
    (item, index) => ({
      item: {
        id: item.id,
        content: item.content,
        sourceName: item.sourceName,
        sourceUri: item.sourceUri,
        metadata: item.metadata,
      },
      rank: index + 1,
    }),
  );
  const semanticRanked: RankedKnowledge<SearchChunk>[] = semantic.map(
    (item, index) => ({ item: item.item, rank: index + 1 }),
  );
  const results = reciprocalRankFusion(lexicalRanked, semanticRanked, 5).map(
    (chunk) => ({
      id: chunk.id,
      sourceName: chunk.sourceName,
      uri: chunk.sourceUri,
      excerpt: chunk.content.slice(0, 1200),
      ...(getChunkPath(chunk.metadata)
        ? { path: getChunkPath(chunk.metadata) }
        : {}),
    }),
  );
  return { results };
}
