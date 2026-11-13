-- Admin RAG configuration: global settings singleton and task profiles.
CREATE TABLE "RagGlobalSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retrievalStrategy" TEXT NOT NULL DEFAULT 'hybrid',
    "enableGlobalKnowledge" BOOLEAN NOT NULL DEFAULT true,
    "enablePersonalKnowledge" BOOLEAN NOT NULL DEFAULT true,
    "enableProjectKnowledge" BOOLEAN NOT NULL DEFAULT true,
    "enableWorkspaceKnowledge" BOOLEAN NOT NULL DEFAULT true,
    "enableCitations" BOOLEAN NOT NULL DEFAULT true,
    "enableRagLogging" BOOLEAN NOT NULL DEFAULT true,
    "fallbackWithoutRag" BOOLEAN NOT NULL DEFAULT true,
    "enableRagEvaluation" BOOLEAN NOT NULL DEFAULT true,
    "embeddingProvider" TEXT NOT NULL DEFAULT 'OPENROUTER',
    "embeddingModel" TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
    "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
    "embeddingBatchSize" INTEGER NOT NULL DEFAULT 32,
    "embeddingRequestTimeoutMs" INTEGER NOT NULL DEFAULT 45000,
    "embeddingRetryCount" INTEGER NOT NULL DEFAULT 2,
    "retrievalStrategyTopK" INTEGER NOT NULL DEFAULT 20,
    "vectorSearchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "keywordSearchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minSimilarity" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "maxContextChunks" INTEGER NOT NULL DEFAULT 5,
    "maxContextTokens" INTEGER NOT NULL DEFAULT 8000,
    "enableMetadataFiltering" BOOLEAN NOT NULL DEFAULT true,
    "enableRrf" BOOLEAN NOT NULL DEFAULT true,
    "rrfK" INTEGER NOT NULL DEFAULT 60,
    "enableReranking" BOOLEAN NOT NULL DEFAULT false,
    "contextDeduplication" BOOLEAN NOT NULL DEFAULT true,
    "includeSourceMetadata" BOOLEAN NOT NULL DEFAULT true,
    "includeFilePath" BOOLEAN NOT NULL DEFAULT true,
    "includeLineNumbers" BOOLEAN NOT NULL DEFAULT true,
    "noResultBehavior" TEXT NOT NULL DEFAULT 'fallback',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RagGlobalSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RagTaskProfile" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retrievalStrategy" TEXT NOT NULL DEFAULT 'hybrid',
    "topK" INTEGER NOT NULL DEFAULT 20,
    "maxContextChunks" INTEGER NOT NULL DEFAULT 5,
    "minSimilarity" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "maxContextTokens" INTEGER NOT NULL DEFAULT 8000,
    "enableReranking" BOOLEAN NOT NULL DEFAULT false,
    "enableCitations" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagTaskProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RagTaskProfile_task_key" ON "RagTaskProfile"("task");
