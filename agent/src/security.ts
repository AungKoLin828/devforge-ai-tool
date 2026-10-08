import path from "node:path";
export function safePath(root: string, relative: string) {
  const base = path.resolve(root),
    target = path.resolve(base, relative);
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
export function validateCommand(command: string) {
  const first = command
    .trim()
    .split(/\s+/)[0]
    .replace(/^.*[\\/]/, "");
  if (!ALLOWED_COMMANDS.includes(first))
    throw new Error(`Command '${first}' is not allowed`);
  return command;
}
