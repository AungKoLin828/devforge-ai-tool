const MAX_DOCUMENT_BYTES = 512 * 1024;
export function parseRagIndexInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Invalid knowledge indexing request.");
    }
    const value = input;
    if (value.provider !== "OPENROUTER" &&
        value.provider !== "OPENAI" &&
        value.provider !== "CUSTOM") {
        throw new Error("Unsupported AI provider.");
    }
    const provider = value.provider;
    if (value.kind === "DOCUMENT") {
        if (typeof value.name !== "string" ||
            typeof value.content !== "string" ||
            !value.name.trim() ||
            value.name.trim().length > 200 ||
            !value.content.trim()) {
            throw new Error("Document name and content are required.");
        }
        if (new TextEncoder().encode(value.content).byteLength > MAX_DOCUMENT_BYTES) {
            throw new Error("Document exceeds the 512 KB import limit.");
        }
        if (value.path !== undefined &&
            (typeof value.path !== "string" ||
                value.path.length > 512 ||
                !value.path.trim() ||
                value.path.startsWith("/") ||
                /^[a-z]:/i.test(value.path) ||
                value.path.replaceAll("\\", "/").split("/").some((part) => part === ".."))) {
            throw new Error("Document path must be a safe relative path.");
        }
        return {
            kind: "DOCUMENT",
            provider,
            name: value.name,
            content: value.content,
            ...(typeof value.path === "string" ? { path: value.path } : {}),
        };
    }
    if (value.kind === "URL" || value.kind === "GITHUB") {
        if (typeof value.url !== "string" ||
            !value.url.trim() ||
            value.url.length > 2048) {
            throw new Error("A valid source URL is required.");
        }
        return { kind: value.kind, provider, url: value.url };
    }
    if (value.kind === "PROJECT")
        return { kind: "PROJECT", provider };
    throw new Error("Unsupported knowledge indexing job.");
}
