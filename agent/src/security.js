import path from "node:path";
/** Resolve a workspace-relative path while rejecting absolute paths and traversal. */
export function safePath(root, relative) {
    if (!relative ||
        path.isAbsolute(relative) ||
        /^[a-z]:/i.test(relative) ||
        relative.split(/[\\/]+/).some((segment) => segment === "..")) {
        throw new Error("Path outside workspace is blocked");
    }
    const base = path.resolve(root), target = path.resolve(base, relative);
    if (target !== base && !target.startsWith(base + path.sep))
        throw new Error("Path outside workspace is blocked");
    return target;
}
// Only executables in this allowlist can be launched by the agent command endpoint.
export const ALLOWED_COMMANDS = [
    "npm",
    "pnpm",
    "yarn",
    "node",
    "npx",
    "java",
    "javac",
    "cargo",
    "go",
    "mvn",
    "mvnw",
    "gradle",
    "gradlew",
    "python",
    "python3",
    "git",
    "docker",
];
/** Verify the first executable in a command string is approved before execution. */
export function validateCommand(command) {
    const first = command
        .trim()
        .split(/\s+/)[0]
        .replace(/^.*[\\/]/, "");
    if (!ALLOWED_COMMANDS.includes(first))
        throw new Error(`Command '${first}' is not allowed`);
    return command;
}
