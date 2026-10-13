import path from "node:path";
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
export const ALLOWED_COMMANDS = [
    "npm",
    "pnpm",
    "yarn",
    "node",
    "npx",
    "java",
    "javac",
    "mvn",
    "mvnw",
    "gradle",
    "gradlew",
    "python",
    "python3",
    "git",
    "docker",
];
export function validateCommand(command) {
    const first = command
        .trim()
        .split(/\s+/)[0]
        .replace(/^.*[\\/]/, "");
    if (!ALLOWED_COMMANDS.includes(first))
        throw new Error(`Command '${first}' is not allowed`);
    return command;
}
