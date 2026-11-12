CREATE TYPE "KnowledgeSourceKind" AS ENUM ('DOCUMENT', 'URL', 'GITHUB', 'PROJECT');

CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "KnowledgeSourceKind" NOT NULL,
    "embeddingProvider" "AIProviderType" NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeSource_projectId_uri_key"
    ON "KnowledgeSource"("projectId", "uri");
CREATE INDEX "KnowledgeSource_projectId_createdAt_idx"
    ON "KnowledgeSource"("projectId", "createdAt");
CREATE INDEX "KnowledgeChunk_projectId_sourceId_idx"
    ON "KnowledgeChunk"("projectId", "sourceId");
CREATE INDEX "KnowledgeChunk_content_fts_idx"
    ON "KnowledgeChunk" USING GIN (to_tsvector('english', "content"));

ALTER TABLE "KnowledgeSource"
    ADD CONSTRAINT "KnowledgeSource_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
