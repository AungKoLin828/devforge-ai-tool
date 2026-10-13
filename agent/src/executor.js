import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { validateCommand, safePath } from "./security.js";
const MAX_OUTPUT_BYTES = 128 * 1024;
const IMPORT_EXCLUDED_DIRECTORIES = new Set([
    ".aws",
    ".azure",
    ".config",
    ".gnupg",
    ".git",
    ".kube",
    ".next",
    ".nuxt",
    ".ssh",
    ".turbo",
    ".venv",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "target",
    "vendor",
]);
const IMPORT_ALLOWED_HIDDEN_FILES = new Set([
    ".babelrc",
    ".dockerignore",
    ".editorconfig",
    ".env.example",
    ".env.sample",
    ".babelrc.json",
    ".eslintrc",
    ".gitignore",
    ".prettierrc",
    ".nvmrc",
    ".prettierignore",
]);
const IMPORT_MAX_FILES = 300;
const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_DIRECTORIES = 5000;
const IMPORT_MAX_DEPTH = 32;
const WORKSPACE_MAX_PROJECTS = 500;
const WORKSPACE_MAX_ENTRIES = 500;
const WORKSPACE_MAX_FILE_BYTES = 1024 * 1024;
const WORKSPACE_EDITABLE_DOTFILES = new Set([
    ".babelrc",
    ".dockerignore",
    ".editorconfig",
    ".eslintrc",
    ".gitignore",
    ".nvmrc",
    ".prettierignore",
]);
function validateWorkspacePath(relative, allowRoot) {
    if (relative === "" && allowRoot)
        return [];
    const segments = relative.split("/");
    if (!relative ||
        relative.startsWith("/") ||
        relative.includes("\\") ||
        /^[a-z]:/i.test(relative) ||
        segments.length > 32 ||
        segments.some((segment) => !segment ||
            segment === "." ||
            segment === ".." ||
            /[<>:"|?*\u0000-\u001f]/.test(segment) ||
            /[. ]$/.test(segment) ||
            /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))) {
        throw new Error("Workspace path is invalid or outside the workspace");
    }
    for (const [index, segment] of segments.entries()) {
        if (IMPORT_EXCLUDED_DIRECTORIES.has(segment.toLowerCase())) {
            throw new Error("This workspace folder is not available in the browser");
        }
        if (segment.startsWith(".") &&
            (index !== segments.length - 1 ||
                !WORKSPACE_EDITABLE_DOTFILES.has(segment.toLowerCase()))) {
            throw new Error("Hidden and sensitive workspace paths are not available");
        }
        if (index === segments.length - 1 &&
            (/^\.env(?:\.|$)/i.test(segment) ||
                /\.(?:key|pem|p12|pfx|keystore)$/i.test(segment) ||
                /^(?:id_rsa|id_ed25519|credentials(?:\..*)?|service-account(?:\..*)?)$/i.test(segment))) {
            throw new Error("Sensitive workspace files are not available in the browser");
        }
    }
    return segments;
}
async function resolveWorkspaceDirectory(root, relative) {
    const rootPath = await fs.realpath(root);
    const segments = validateWorkspacePath(relative, true);
    let currentPath = rootPath;
    for (const segment of segments) {
        currentPath = path.join(currentPath, segment);
        const stat = await fs.lstat(currentPath);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new Error("Workspace folders cannot use symbolic links");
        }
    }
    return { rootPath, target: currentPath };
}
async function resolveWorkspaceFile(root, relative) {
    const rootPath = await fs.realpath(root);
    const segments = validateWorkspacePath(relative, false);
    let currentPath = rootPath;
    for (const segment of segments.slice(0, -1)) {
        currentPath = path.join(currentPath, segment);
        const stat = await fs.lstat(currentPath);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new Error("Workspace paths cannot use symbolic links");
        }
    }
    const target = path.join(currentPath, segments[segments.length - 1]);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error("Select a regular file inside the agent workspace");
    }
    return { rootPath, target, stat };
}
export async function listWorkspaceEntries(root, relativeDirectory = "") {
    const { rootPath, target } = await resolveWorkspaceDirectory(root, relativeDirectory);
    const entries = await fs.readdir(target, { withFileTypes: true });
    const visible = [];
    for (const entry of entries) {
        if (entry.isSymbolicLink())
            continue;
        if (entry.isDirectory() &&
            IMPORT_EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) {
            continue;
        }
        if (entry.name.startsWith(".") && !WORKSPACE_EDITABLE_DOTFILES.has(entry.name.toLowerCase())) {
            continue;
        }
        if (entry.name.startsWith(".") &&
            /^\.env(?:\.|$)/i.test(entry.name) &&
            ![".env.example", ".env.sample"].includes(entry.name.toLowerCase())) {
            continue;
        }
        if (/\.(?:key|pem|p12|pfx|keystore)$/i.test(entry.name) ||
            /^(?:id_rsa|id_ed25519|credentials(?:\..*)?|service-account(?:\..*)?)$/i.test(entry.name)) {
            continue;
        }
        const entryPath = relativeDirectory
            ? `${relativeDirectory}/${entry.name}`
            : entry.name;
        const segments = validateWorkspacePath(entryPath, false);
        if (segments.length > 32)
            continue;
        if (entry.isDirectory()) {
            const entryStat = await fs.lstat(path.join(target, entry.name));
            if (!entryStat.isSymbolicLink() && entryStat.isDirectory()) {
                visible.push({ name: entry.name, path: entryPath, type: "directory" });
            }
        }
        else if (entry.isFile()) {
            const entryStat = await fs.lstat(path.join(target, entry.name));
            if (!entryStat.isSymbolicLink() && entryStat.isFile()) {
                visible.push({
                    name: entry.name,
                    path: entryPath,
                    type: "file",
                    size: entryStat.size,
                    editable: entryStat.size <= WORKSPACE_MAX_FILE_BYTES,
                });
            }
        }
    }
    if (visible.length > WORKSPACE_MAX_ENTRIES) {
        throw new Error(`This folder contains more than ${WORKSPACE_MAX_ENTRIES} visible entries`);
    }
    visible.sort((left, right) => left.type !== right.type
        ? left.type === "directory"
            ? -1
            : 1
        : left.name.localeCompare(right.name));
    return {
        path: relativeDirectory,
        parent: relativeDirectory && relativeDirectory.includes("/")
            ? relativeDirectory.slice(0, relativeDirectory.lastIndexOf("/"))
            : relativeDirectory
                ? ""
                : null,
        entries: visible,
        workspaceRoot: rootPath,
    };
}
export async function readWorkspaceFile(root, relativeFilePath) {
    const { target, stat } = await resolveWorkspaceFile(root, relativeFilePath);
    if (stat.size > WORKSPACE_MAX_FILE_BYTES) {
        throw new Error("Files larger than 1 MB cannot be opened in the browser editor");
    }
    const buffer = await fs.readFile(target);
    if (buffer.includes(0)) {
        throw new Error("Binary files cannot be opened in the browser editor");
    }
    let content;
    try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    }
    catch {
        throw new Error("This file is not valid UTF-8 text");
    }
    return { path: relativeFilePath, content, modifiedAt: stat.mtimeMs };
}
export async function writeWorkspaceFile(root, relativeFilePath, content, expectedModifiedAt) {
    if (typeof content !== "string") {
        throw new Error("File content must be text");
    }
    if (content.includes("\0")) {
        throw new Error("Binary file content cannot be saved from the browser editor");
    }
    if (Buffer.byteLength(content, "utf8") > WORKSPACE_MAX_FILE_BYTES) {
        throw new Error("Files larger than 1 MB cannot be saved from the browser editor");
    }
    if (!Number.isFinite(expectedModifiedAt)) {
        throw new Error("Reload the file before saving your changes");
    }
    const { target, stat } = await resolveWorkspaceFile(root, relativeFilePath);
    if (stat.size > WORKSPACE_MAX_FILE_BYTES) {
        throw new Error("Files larger than 1 MB cannot be edited in the browser");
    }
    if (stat.mtimeMs !== expectedModifiedAt) {
        throw new Error("This file changed on your PC. Reload it before saving.");
    }
    const noFollow = fsConstants.O_NOFOLLOW || 0;
    const handle = await fs.open(target, fsConstants.O_RDWR | noFollow);
    try {
        const openedStat = await handle.stat();
        if (!openedStat.isFile() || openedStat.mtimeMs !== expectedModifiedAt) {
            throw new Error("This file changed on your PC. Reload it before saving.");
        }
        await handle.truncate(0);
        await handle.writeFile(content, "utf8");
        const savedStat = await handle.stat();
        return { path: relativeFilePath, modifiedAt: savedStat.mtimeMs };
    }
    finally {
        await handle.close();
    }
}
async function resolveCommand(command, args, workingDirectory) {
    if (["gradlew", "mvnw"].includes(command)) {
        if (process.platform !== "win32") {
            return { command: `./${command}`, args };
        }
        const wrapperPath = path.join(workingDirectory, command === "gradlew" ? "gradlew.bat" : "mvnw.cmd");
        try {
            await fs.access(wrapperPath);
            return {
                command: process.env.ComSpec || "cmd.exe",
                args: [
                    "/d",
                    "/s",
                    "/c",
                    `"${wrapperPath}" ${args
                        .map((arg) => `"${arg.replaceAll('"', '""')}"`)
                        .join(" ")}`,
                ],
            };
        }
        catch {
            throw new Error(`The ${command} wrapper file was not found in the project`);
        }
    }
    if (process.platform !== "win32" || !["npm", "npx", "pnpm", "yarn"].includes(command)) {
        if (process.platform === "win32" &&
            ["mvn", "gradle"].includes(command)) {
            const executable = command === "mvn" ? "mvn.cmd" : "gradle.bat";
            for (const directory of (process.env.PATH || "").split(path.delimiter)) {
                const executablePath = path.join(directory, executable);
                try {
                    await fs.access(executablePath);
                    return {
                        command: process.env.ComSpec || "cmd.exe",
                        args: ["/d", "/s", "/c", `"${executablePath}" ${args.map((arg) => `"${arg.replaceAll('"', '""')}"`).join(" ")}`],
                    };
                }
                catch {
                    // Continue searching PATH.
                }
            }
        }
        return { command, args };
    }
    const cliByCommand = {
        npm: ["node_modules", "npm", "bin", "npm-cli.js"],
        npx: ["node_modules", "npm", "bin", "npx-cli.js"],
        pnpm: ["node_modules", "pnpm", "bin", "pnpm.cjs"],
        yarn: ["node_modules", "yarn", "bin", "yarn.js"],
    };
    for (const directory of (process.env.PATH || "").split(path.delimiter)) {
        const cliPath = path.join(directory, ...cliByCommand[command]);
        try {
            await fs.access(cliPath);
            return { command: process.execPath, args: [cliPath, ...args] };
        }
        catch {
            // Check the next PATH entry.
        }
        if (command === "pnpm" || command === "yarn") {
            const corepackPath = path.join(directory, "node_modules", "corepack", "dist", `${command}.js`);
            try {
                await fs.access(corepackPath);
                return { command: process.execPath, args: [corepackPath, ...args] };
            }
            catch {
                // Check the next PATH entry.
            }
        }
    }
    throw new Error(`Could not find the ${command} JavaScript CLI. Install Node.js and ${command}, then restart the local agent.`);
}
async function ensureSafeDirectory(root, relative) {
    const rootPath = await fs.realpath(root);
    const target = safePath(rootPath, relative);
    const relativeTarget = path.relative(rootPath, target);
    let current = rootPath;
    for (const segment of relativeTarget.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        try {
            const stat = await fs.lstat(current);
            if (stat.isSymbolicLink() || !stat.isDirectory()) {
                throw new Error("Project paths cannot use symbolic links");
            }
        }
        catch (cause) {
            if (cause.code !== "ENOENT")
                throw cause;
            await fs.mkdir(current);
        }
    }
    return target;
}
async function assertSafeFilePath(root, target) {
    const rootPath = await fs.realpath(root);
    const relativeTarget = path.relative(rootPath, target);
    if (relativeTarget.startsWith("..") ||
        path.isAbsolute(relativeTarget) ||
        !relativeTarget) {
        throw new Error("Path outside workspace is blocked");
    }
    const segments = relativeTarget.split(path.sep);
    let current = rootPath;
    for (const segment of segments.slice(0, -1)) {
        current = path.join(current, segment);
        try {
            const stat = await fs.lstat(current);
            if (stat.isSymbolicLink() || !stat.isDirectory()) {
                throw new Error("Project paths cannot use symbolic links");
            }
        }
        catch (cause) {
            if (cause.code !== "ENOENT")
                throw cause;
            await fs.mkdir(current);
        }
    }
    try {
        const stat = await fs.lstat(target);
        if (stat.isSymbolicLink() || !stat.isFile()) {
            throw new Error("Generated file paths cannot overwrite links or directories");
        }
    }
    catch (cause) {
        if (cause.code !== "ENOENT")
            throw cause;
    }
}
export async function writeProjectFiles(root, relativeProjectPath, files) {
    if (!Array.isArray(files) || files.length === 0 || files.length > 500) {
        throw new Error("Project must contain between 1 and 500 files");
    }
    const projectRoot = await ensureSafeDirectory(root, relativeProjectPath);
    const rootRealPath = await fs.realpath(root);
    let totalBytes = 0;
    for (const file of files) {
        if (!file ||
            typeof file.path !== "string" ||
            typeof file.content !== "string" ||
            !file.path.trim()) {
            throw new Error("Generated project contains an invalid file");
        }
        const target = safePath(projectRoot, file.path);
        totalBytes += Buffer.byteLength(file.content, "utf8");
        if (totalBytes > 5 * 1024 * 1024) {
            throw new Error("Generated project exceeds the 5 MB workspace limit");
        }
        await assertSafeFilePath(rootRealPath, target);
        await fs.writeFile(target, file.content, { encoding: "utf8", flag: "w" });
    }
    return {
        path: path.relative(rootRealPath, projectRoot).split(path.sep).join("/"),
        files: files.length,
    };
}
export async function listWorkspaceProjects(root) {
    const rootPath = await fs.realpath(root);
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
        if (entry.name.startsWith(".") || !entry.isDirectory())
            continue;
        const projectPath = safePath(rootPath, entry.name);
        const stat = await fs.lstat(projectPath);
        if (stat.isSymbolicLink() || !stat.isDirectory())
            continue;
        if (entry.name === "projects") {
            const children = await fs.readdir(projectPath, { withFileTypes: true });
            for (const child of children) {
                if (child.name.startsWith(".") || !child.isDirectory())
                    continue;
                const childPath = safePath(rootPath, path.join(entry.name, child.name));
                const childStat = await fs.lstat(childPath);
                if (!childStat.isSymbolicLink() && childStat.isDirectory()) {
                    projects.push({
                        name: child.name,
                        path: path.join(entry.name, child.name).split(path.sep).join("/"),
                    });
                    if (projects.length > WORKSPACE_MAX_PROJECTS) {
                        throw new Error(`Workspace contains more than ${WORKSPACE_MAX_PROJECTS} project folders`);
                    }
                }
            }
            continue;
        }
        projects.push({ name: entry.name, path: entry.name });
        if (projects.length > WORKSPACE_MAX_PROJECTS) {
            throw new Error(`Workspace contains more than ${WORKSPACE_MAX_PROJECTS} project folders`);
        }
    }
    return projects.sort((left, right) => left.name.localeCompare(right.name));
}
export async function readLocalProject(root, relativeProjectPath) {
    const rootPath = await fs.realpath(root);
    const projectRoot = safePath(rootPath, relativeProjectPath);
    const relativePath = path.relative(rootPath, projectRoot);
    const segments = relativePath.split(path.sep).filter(Boolean);
    if (!relativePath ||
        relativePath.startsWith("..") ||
        path.isAbsolute(relativePath)) {
        throw new Error("Select a project folder inside the agent workspace");
    }
    let currentPath = rootPath;
    for (const segment of segments) {
        currentPath = path.join(currentPath, segment);
        const stat = await fs.lstat(currentPath).catch((cause) => {
            if (cause &&
                typeof cause === "object" &&
                "code" in cause &&
                cause.code === "ENOENT") {
                throw new Error("The selected project folder no longer exists");
            }
            throw cause;
        });
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new Error("Select a real project folder inside the agent workspace");
        }
    }
    const files = [];
    let totalBytes = 0;
    let visitedDirectories = 0;
    const visit = async (directory, relativeDirectory, depth) => {
        visitedDirectories++;
        if (visitedDirectories > IMPORT_MAX_DIRECTORIES) {
            throw new Error(`Local project exceeds the ${IMPORT_MAX_DIRECTORIES}-directory scan limit`);
        }
        if (depth > IMPORT_MAX_DEPTH) {
            throw new Error(`Local project exceeds the ${IMPORT_MAX_DEPTH}-level folder depth limit`);
        }
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const relativePath = relativeDirectory
                ? path.join(relativeDirectory, entry.name)
                : entry.name;
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (IMPORT_EXCLUDED_DIRECTORIES.has(entry.name))
                    continue;
                const stat = await fs.lstat(fullPath);
                if (stat.isSymbolicLink())
                    continue;
                await visit(fullPath, relativePath, depth + 1);
                continue;
            }
            if (!entry.isFile() ||
                entry.name.startsWith(".") &&
                    !IMPORT_ALLOWED_HIDDEN_FILES.has(entry.name) &&
                    !/^\.eslintrc\./i.test(entry.name) &&
                    !/^\.prettierrc\./i.test(entry.name) &&
                    !/^\.yarnrc\./i.test(entry.name)) {
                continue;
            }
            if (/^\.env(?:\.|$)/i.test(entry.name) &&
                ![".env.example", ".env.sample"].includes(entry.name.toLowerCase())) {
                continue;
            }
            if (/\.(?:key|pem|p12|pfx|keystore)$/i.test(entry.name) ||
                /^(?:id_rsa|id_ed25519|credentials(?:\..*)?|service-account(?:\..*)?)$/i.test(entry.name)) {
                continue;
            }
            const stat = await fs.lstat(fullPath);
            if (stat.isSymbolicLink() || stat.size === 0)
                continue;
            if (files.length >= IMPORT_MAX_FILES) {
                throw new Error(`Local project exceeds the ${IMPORT_MAX_FILES}-file import limit`);
            }
            if (stat.size > IMPORT_MAX_BYTES - totalBytes) {
                throw new Error("Local project exceeds the 2 MB text import limit");
            }
            const buffer = await fs.readFile(fullPath);
            if (buffer.includes(0))
                continue;
            let content;
            try {
                content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
            }
            catch {
                continue;
            }
            totalBytes += buffer.length;
            if (totalBytes > IMPORT_MAX_BYTES) {
                throw new Error("Local project exceeds the 2 MB text import limit");
            }
            files.push({
                path: relativePath.split(path.sep).join("/"),
                content,
            });
        }
    };
    await visit(projectRoot, "", 0);
    if (files.length === 0) {
        throw new Error("No importable text files were found in this project folder");
    }
    return {
        name: path.basename(projectRoot),
        path: path.relative(rootPath, projectRoot).split(path.sep).join("/"),
        files,
    };
}
export async function runCommand(root, command, timeoutMs = 120000) {
    validateCommand(command);
    const [bin, ...args] = command.trim().split(/\s+/);
    const workingDirectory = safePath(root, ".");
    const invocation = await resolveCommand(bin, args, workingDirectory);
    return new Promise((resolve, reject) => {
        const p = spawn(invocation.command, invocation.args, {
            cwd: workingDirectory,
            shell: false,
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        let outputBytes = 0;
        let truncated = false;
        let settled = false;
        const appendOutput = (target, chunk) => {
            const remaining = MAX_OUTPUT_BYTES - outputBytes;
            if (remaining <= 0) {
                truncated = true;
                return;
            }
            const captured = chunk.subarray(0, remaining).toString("utf8");
            outputBytes += Buffer.byteLength(captured, "utf8");
            if (captured.length < chunk.length)
                truncated = true;
            if (target === "stdout")
                stdout += captured;
            else
                stderr += captured;
        };
        const t = setTimeout(() => {
            p.kill();
            if (!settled) {
                settled = true;
                reject(new Error("Command timeout"));
            }
        }, timeoutMs);
        p.stdout.on("data", (d) => appendOutput("stdout", d));
        p.stderr.on("data", (d) => appendOutput("stderr", d));
        p.on("error", (cause) => {
            clearTimeout(t);
            if (!settled) {
                settled = true;
                reject(cause);
            }
        });
        p.on("close", (code) => {
            clearTimeout(t);
            if (!settled) {
                settled = true;
                resolve({ code, stdout, stderr, truncated });
            }
        });
    });
}
export async function runProjectAction(root, relativeProjectPath, action) {
    const projectRoot = safePath(root, relativeProjectPath);
    const rootRealPath = await fs.realpath(root);
    const safeProjectRoot = await ensureSafeDirectory(rootRealPath, path.relative(rootRealPath, projectRoot));
    const manifestPath = path.join(safeProjectRoot, "package.json");
    const stages = [];
    const addStage = async (name, command, timeoutMs = 12 * 60 * 1000) => {
        try {
            const result = await runCommand(safeProjectRoot, command, timeoutMs);
            stages.push({ name, command, ...result });
            return result.code === 0;
        }
        catch (cause) {
            stages.push({
                name,
                command,
                code: null,
                stdout: "",
                stderr: cause instanceof Error ? cause.message : "Command failed",
                truncated: false,
            });
            return false;
        }
    };
    let manifest = null;
    try {
        manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    }
    catch (cause) {
        if (cause.code !== "ENOENT" && cause instanceof SyntaxError) {
            throw new Error("The generated package.json is invalid");
        }
        if (cause.code !== "ENOENT")
            throw cause;
    }
    const scripts = manifest?.scripts ?? {};
    const hasScript = (name) => typeof scripts[name] === "string" && Boolean(scripts[name].trim());
    const manager = manifest?.packageManager?.split("@")[0];
    const lockFiles = await Promise.all(["pnpm-lock.yaml", "yarn.lock", "package-lock.json"].map(async (name) => {
        try {
            await fs.access(path.join(safeProjectRoot, name));
            return name;
        }
        catch {
            return null;
        }
    }));
    const packageManager = manager === "pnpm" || lockFiles.includes("pnpm-lock.yaml")
        ? "pnpm"
        : manager === "yarn" || lockFiles.includes("yarn.lock")
            ? "yarn"
            : "npm";
    if (manifest) {
        try {
            await fs.access(path.join(safeProjectRoot, "node_modules"));
        }
        catch {
            const installCommand = packageManager === "pnpm"
                ? "pnpm install --no-frozen-lockfile"
                : packageManager === "yarn"
                    ? "yarn install"
                    : lockFiles.includes("package-lock.json")
                        ? "npm ci"
                        : "npm install";
            if (!(await addStage("Install dependencies", installCommand))) {
                return { action, stages, success: false };
            }
        }
        if (action === "build") {
            if (!hasScript("build")) {
                stages.push({
                    name: "Build",
                    command: `${packageManager} run build`,
                    code: null,
                    stdout: "",
                    stderr: "package.json does not define a build script.",
                    truncated: false,
                });
                return { action, stages, success: false };
            }
            const success = await addStage("Build", `${packageManager} run build`);
            return { action, stages, success };
        }
        if (hasScript("test")) {
            const success = await addStage("Test", `${packageManager} test`);
            return { action, stages, success };
        }
        if (hasScript("test:unit")) {
            const success = await addStage("Unit tests", `${packageManager} run test:unit`);
            return { action, stages, success };
        }
        stages.push({
            name: "Test",
            command: `${packageManager} test`,
            code: null,
            stdout: "",
            stderr: "package.json does not define a test or test:unit script.",
            truncated: false,
        });
        return { action, stages, success: false };
    }
    const projectEntries = await fs.readdir(safeProjectRoot);
    const entrySet = new Set(projectEntries);
    const pythonFiles = projectEntries.some((entry) => entry.endsWith(".py"));
    if (entrySet.has("go.mod") ||
        entrySet.has("Cargo.toml") ||
        entrySet.has("pom.xml") ||
        entrySet.has("build.gradle") ||
        entrySet.has("build.gradle.kts")) {
        if (entrySet.has("go.mod")) {
            const command = action === "build" ? "go build ./..." : "go test ./...";
            return {
                action,
                stages,
                success: await addStage(action === "build" ? "Go build" : "Go tests", command),
            };
        }
        if (entrySet.has("Cargo.toml")) {
            const command = action === "build" ? "cargo build" : "cargo test";
            return {
                action,
                stages,
                success: await addStage(action === "build" ? "Rust build" : "Rust tests", command),
            };
        }
        if (entrySet.has("pom.xml")) {
            const maven = entrySet.has("mvnw") || entrySet.has("mvnw.cmd") ? "mvnw" : "mvn";
            const command = action === "build"
                ? `${maven} package -DskipTests`
                : `${maven} test`;
            return {
                action,
                stages,
                success: await addStage(action === "build" ? "Maven build" : "Maven tests", command),
            };
        }
        const gradle = entrySet.has("gradlew") || entrySet.has("gradlew.bat")
            ? "gradlew"
            : "gradle";
        const command = action === "build" ? `${gradle} build` : `${gradle} test`;
        return {
            action,
            stages,
            success: await addStage(action === "build" ? "Gradle build" : "Gradle tests", command),
        };
    }
    if (entrySet.has("pyproject.toml") ||
        entrySet.has("setup.py") ||
        entrySet.has("requirements.txt") ||
        pythonFiles) {
        const command = action === "build"
            ? "python -m compileall -q ."
            : "python -m unittest discover";
        return {
            action,
            stages,
            success: await addStage(action === "build" ? "Python syntax check" : "Python unit tests", command),
        };
    }
    if (entrySet.has("index.html")) {
        if (action === "build") {
            stages.push({
                name: "Static site",
                command: "No build command required",
                code: 0,
                stdout: "This project has an index.html and no build configuration. Its static files are ready to serve.",
                stderr: "",
                truncated: false,
            });
            return { action, stages, success: true };
        }
    }
    stages.push({
        name: action === "build" ? "Build configuration" : "Test configuration",
        command: "Not run",
        code: null,
        stdout: "",
        stderr: "No supported build/test configuration was found. Add a package.json script, Python project files, go.mod, Cargo.toml, pom.xml, or Gradle build file. You can ask the AI Assistant to help create the missing configuration.",
        truncated: false,
    });
    return { action, stages, success: false };
}
