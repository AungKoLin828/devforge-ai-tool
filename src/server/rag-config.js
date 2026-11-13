// Shared admin RAG configuration service: load, validate, save and audit settings.
import { prisma } from "./db.js";
import { embeddingModel } from "./ai.js";
const RETRIEVAL_STRATEGIES = new Set(["vector", "keyword", "hybrid"]);
const NO_RESULT_BEHAVIORS = new Set(["fallback", "empty"]);
const AI_TASKS = new Set([
    "chat",
    "generate",
    "modify",
    "review",
    "explain",
    "tests",
    "fix",
    "refactor",
    "project",
    "workspace-review",
]);
const limits = {
    topK: { min: 1, max: 100 },
    maxContextChunks: { min: 1, max: 40 },
    maxContextTokens: { min: 500, max: 32000 },
    minSimilarity: { min: 0, max: 1 },
    embeddingBatchSize: { min: 1, max: 128 },
    embeddingRequestTimeoutMs: { min: 5000, max: 120000 },
    embeddingRetryCount: { min: 0, max: 5 },
    rrfK: { min: 1, max: 1000 },
};
function clampInt(value, setting, fallback) {
    const parsed = typeof value === "number" ? Math.floor(value) : Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(limits[setting].max, Math.max(limits[setting].min, parsed));
}
function clampFloat(value, setting, fallback) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(limits[setting].max, Math.max(limits[setting].min, parsed));
}
function clampBool(value, fallback) {
    if (typeof value === "boolean")
        return value;
    return fallback;
}
function clampChoice(value, allowed, fallback) {
    return typeof value === "string" && allowed.has(value) ? value : fallback;
}
/** Load (and lazily create) the global settings singleton. */
export async function getRagSettings() {
    const existing = await prisma.ragGlobalSettings.findFirst();
    if (existing)
        return existing;
    return prisma.ragGlobalSettings.create({ data: {} });
}
/**
 * Validate and apply an admin settings patch. Every field is clamped to
 * server-side bounds so a bad client cannot persist unsafe configuration.
 */
export async function updateRagSettings(patch, adminUserId) {
    const input = patch && typeof patch === "object" ? patch : {};
    const badKeys = Object.keys(input).filter((key) => ![
        "enabled",
        "retrievalStrategy",
        "enableGlobalKnowledge",
        "enablePersonalKnowledge",
        "enableProjectKnowledge",
        "enableWorkspaceKnowledge",
        "enableCitations",
        "enableRagLogging",
        "fallbackWithoutRag",
        "enableRagEvaluation",
        "embeddingProvider",
        "embeddingModel",
        "embeddingDimensions",
        "embeddingBatchSize",
        "embeddingRequestTimeoutMs",
        "embeddingRetryCount",
        "retrievalStrategyTopK",
        "vectorSearchEnabled",
        "keywordSearchEnabled",
        "minSimilarity",
        "maxContextChunks",
        "maxContextTokens",
        "enableMetadataFiltering",
        "enableRrf",
        "rrfK",
        "enableReranking",
        "contextDeduplication",
        "includeSourceMetadata",
        "includeFilePath",
        "includeLineNumbers",
        "noResultBehavior",
    ].includes(key));
    if (badKeys.length)
        throw new Error(`Unknown RAG settings: ${badKeys.join(", ")}`);
    const current = await getRagSettings();
    const provider = clampChoice(input.embeddingProvider, new Set(["OPENROUTER", "OPENAI", "CUSTOM"]), current.embeddingProvider);
    const next = {
        enabled: clampBool(input.enabled, current.enabled),
        retrievalStrategy: clampChoice(input.retrievalStrategy, RETRIEVAL_STRATEGIES, current.retrievalStrategy),
        enableGlobalKnowledge: clampBool(input.enableGlobalKnowledge, current.enableGlobalKnowledge),
        enablePersonalKnowledge: clampBool(input.enablePersonalKnowledge, current.enablePersonalKnowledge),
        enableProjectKnowledge: clampBool(input.enableProjectKnowledge, current.enableProjectKnowledge),
        enableWorkspaceKnowledge: clampBool(input.enableWorkspaceKnowledge, current.enableWorkspaceKnowledge),
        enableCitations: clampBool(input.enableCitations, current.enableCitations),
        enableRagLogging: clampBool(input.enableRagLogging, current.enableRagLogging),
        fallbackWithoutRag: clampBool(input.fallbackWithoutRag, current.fallbackWithoutRag),
        enableRagEvaluation: clampBool(input.enableRagEvaluation, current.enableRagEvaluation),
        embeddingProvider: provider,
        embeddingModel: typeof input.embeddingModel === "string" && input.embeddingModel.trim()
            ? input.embeddingModel.trim().slice(0, 200)
            : current.embeddingModel,
        embeddingDimensions: clampInt(input.embeddingDimensions, "maxContextChunks", current.embeddingDimensions),
        embeddingBatchSize: clampInt(input.embeddingBatchSize, "embeddingBatchSize", current.embeddingBatchSize),
        embeddingRequestTimeoutMs: clampInt(input.embeddingRequestTimeoutMs, "embeddingRequestTimeoutMs", current.embeddingRequestTimeoutMs),
        embeddingRetryCount: clampInt(input.embeddingRetryCount, "embeddingRetryCount", current.embeddingRetryCount),
        retrievalStrategyTopK: clampInt(input.retrievalStrategyTopK, "topK", current.retrievalStrategyTopK),
        vectorSearchEnabled: clampBool(input.vectorSearchEnabled, current.vectorSearchEnabled),
        keywordSearchEnabled: clampBool(input.keywordSearchEnabled, current.keywordSearchEnabled),
        minSimilarity: clampFloat(input.minSimilarity, "minSimilarity", current.minSimilarity),
        maxContextChunks: clampInt(input.maxContextChunks, "maxContextChunks", current.maxContextChunks),
        maxContextTokens: clampInt(input.maxContextTokens, "maxContextTokens", current.maxContextTokens),
        enableMetadataFiltering: clampBool(input.enableMetadataFiltering, current.enableMetadataFiltering),
        enableRrf: clampBool(input.enableRrf, current.enableRrf),
        rrfK: clampInt(input.rrfK, "rrfK", current.rrfK),
        enableReranking: clampBool(input.enableReranking, current.enableReranking),
        contextDeduplication: clampBool(input.contextDeduplication, current.contextDeduplication),
        includeSourceMetadata: clampBool(input.includeSourceMetadata, current.includeSourceMetadata),
        includeFilePath: clampBool(input.includeFilePath, current.includeFilePath),
        includeLineNumbers: clampBool(input.includeLineNumbers, current.includeLineNumbers),
        noResultBehavior: clampChoice(input.noResultBehavior, NO_RESULT_BEHAVIORS, current.noResultBehavior),
    };
    if (typeof input.embeddingDimensions === "number" && Number.isFinite(input.embeddingDimensions)) {
        next.embeddingDimensions = Math.min(4096, Math.max(64, Math.floor(input.embeddingDimensions)));
    }
    const updated = await prisma.ragGlobalSettings.update({
        where: { id: current.id },
        data: { ...next, updatedByUserId: adminUserId },
    });
    try {
        await prisma.auditLog.create({
            data: {
                userId: adminUserId,
                action: "rag.settings.update",
                entityType: "RagGlobalSettings",
                entityId: updated.id,
                metadata: { patch: input },
            },
        });
    }
    catch (cause) {
        console.error("Could not record RAG settings audit log", cause);
    }
    return updated;
}
/** The effective configuration for an AI task: global defaults + task profile override. */
export async function getEffectiveRagSettings(task) {
    const global = await getRagSettings();
    let profile = null;
    if (task && AI_TASKS.has(task)) {
        profile = await prisma.ragTaskProfile.findUnique({ where: { task } });
    }
    return {
        enabled: global.enabled && (!profile || profile.enabled),
        retrievalStrategy: profile?.retrievalStrategy ?? global.retrievalStrategy,
        embeddingProvider: global.embeddingProvider,
        embeddingModel: global.embeddingModel || embeddingModel(global.embeddingProvider),
        embeddingDimensions: global.embeddingDimensions,
        embeddingBatchSize: global.embeddingBatchSize,
        embeddingRequestTimeoutMs: global.embeddingRequestTimeoutMs,
        embeddingRetryCount: global.embeddingRetryCount,
        vectorSearchEnabled: global.vectorSearchEnabled,
        keywordSearchEnabled: global.keywordSearchEnabled,
        topK: profile?.topK ?? global.retrievalStrategyTopK,
        minSimilarity: profile?.minSimilarity ?? global.minSimilarity,
        maxContextChunks: profile?.maxContextChunks ?? global.maxContextChunks,
        maxContextTokens: profile?.maxContextTokens ?? global.maxContextTokens,
        enableMetadataFiltering: global.enableMetadataFiltering,
        enableRrf: global.enableRrf,
        rrfK: global.rrfK,
        enableReranking: profile?.enableReranking ?? global.enableReranking,
        contextDeduplication: global.contextDeduplication,
        includeSourceMetadata: global.includeSourceMetadata,
        includeFilePath: global.includeFilePath,
        includeLineNumbers: global.includeLineNumbers,
        enableCitations: profile?.enableCitations ?? global.enableCitations,
        noResultBehavior: global.noResultBehavior,
    };
}
function validateProfilePatch(input) {
    const data = {};
    if (input.enabled !== undefined)
        data.enabled = clampBool(input.enabled, true);
    if (input.retrievalStrategy !== undefined)
        data.retrievalStrategy = clampChoice(input.retrievalStrategy, RETRIEVAL_STRATEGIES, "hybrid");
    if (input.topK !== undefined)
        data.topK = clampInt(input.topK, "topK", 20);
    if (input.maxContextChunks !== undefined)
        data.maxContextChunks = clampInt(input.maxContextChunks, "maxContextChunks", 5);
    if (input.minSimilarity !== undefined)
        data.minSimilarity = clampFloat(input.minSimilarity, "minSimilarity", 0.65);
    if (input.maxContextTokens !== undefined)
        data.maxContextTokens = clampInt(input.maxContextTokens, "maxContextTokens", 8000);
    if (input.enableReranking !== undefined)
        data.enableReranking = clampBool(input.enableReranking, false);
    if (input.enableCitations !== undefined)
        data.enableCitations = clampBool(input.enableCitations, true);
    return data;
}
/** List all task profiles, creating defaults lazily for known AI tasks. */
export async function listRagTaskProfiles() {
    const existing = await prisma.ragTaskProfile.findMany({ orderBy: { task: "asc" } });
    const missing = [...AI_TASKS].filter((task) => !existing.some((p) => p.task === task));
    if (missing.length) {
        await prisma.ragTaskProfile.createMany({
            data: missing.map((task) => ({ task })),
            skipDuplicates: true,
        });
        return prisma.ragTaskProfile.findMany({ orderBy: { task: "asc" } });
    }
    return existing;
}
/** Update (upsert) one task profile with server-side validation and auditing. */
export async function updateRagTaskProfile(task, patch, adminUserId) {
    if (!AI_TASKS.has(task))
        throw new Error("Unknown AI task profile");
    const data = validateProfilePatch(patch);
    const updated = await prisma.ragTaskProfile.upsert({
        where: { task },
        update: data,
        create: { task, ...data },
    });
    await prisma.auditLog.create({
        data: {
            userId: adminUserId,
            action: "rag.taskProfile.update",
            entityType: "RagTaskProfile",
            entityId: updated.id,
            metadata: { task, patch: patch },
        },
    });
    return updated;
}
