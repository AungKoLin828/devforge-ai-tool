import { createHash } from "node:crypto";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".vscode",
  "bin",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "obj",
  "out",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
]);

const EXCLUDED_FILES = new Set([
  ".npmrc",
  ".pypirc",
  ".netrc",
  ".env",
  "credentials",
  "credentials.json",
  "secrets",
  "secrets.json",
  "id_rsa",
  "id_ed25519",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".kts",
  ".md",
  ".mdx",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".rst",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);

function matchesGlob(path: string, pattern: string): boolean {
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.?\//, "");
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, ".*");
  const expression = normalized.includes("/")
    ? new RegExp(`^${escaped}$`, "i")
    : new RegExp(`(?:^|/)${escaped}$`, "i");
  return expression.test(path);
}

/** Apply default secret/build exclusions and user-configured glob patterns. */
export function isEligibleWorkspacePath(
  input: string,
  customExcludes: string[] = [],
): boolean {
  const path = input.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!path || path.split("/").some((part) => EXCLUDED_DIRS.has(part.toLowerCase()))) {
    return false;
  }
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  if (
    EXCLUDED_FILES.has(base) ||
    base.startsWith(".env.") ||
    /(?:^|[._-])(?:secret|credential|private[-_]?key|token)(?:[._-]|$)/i.test(
      base,
    ) ||
    /\.(?:pem|p12|pfx|key|crt|cer|der)$/i.test(base)
  ) {
    return false;
  }
  if (customExcludes.some((pattern) => matchesGlob(path, pattern))) return false;
  const extension = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
  return SUPPORTED_EXTENSIONS.has(extension);
}

export function hashWorkspaceContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function hasCompatibleWorkspaceEmbedding(
  source: { embeddingProvider?: string; embeddingModel?: string },
  provider: string,
  model: string,
): boolean {
  return source.embeddingProvider === provider && source.embeddingModel === model;
}

/** Hash the local workspace URI without uploading or storing its absolute path. */
export function getWorkspaceKey(workspaceUri: string): string {
  return createHash("sha256").update(workspaceUri).digest("hex").slice(0, 12);
}
