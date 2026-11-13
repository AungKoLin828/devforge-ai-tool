ALTER TABLE "AIProvider"
    ADD COLUMN "fallbackProvider" "AIProviderType",
    ADD COLUMN "fallbackModel" TEXT,
    ADD COLUMN "temperature" DOUBLE PRECISION,
    ADD COLUMN "maxTokens" INTEGER;
