import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";

const bridgePort = 45822;
const agentPort = 45821;
const agentFiles = {
  "index.js": "6C0277E663AEAE6A6E5E7FAD40F29745DC54E6EAAEEC795BF079458133A79721",
  "executor.js": "FB1059A897334989321F14A0A841D4EB7C32667400B0909B10AD15DAC1C54151",
  "security.js": "109A76165151907E8433D4AE2F4B5F45C5FFE8750E0E10E94DC97F78F2BEA864",
};
const allowedOrigins = new Set([
  "http://localhost:8888",
  "http://localhost:5173",
  "https://devforge-ai-tool.netlify.app",
]);
let startTask: Promise<void> | undefined;

function respond(
  response: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
  origin?: string,
): void {
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "content-type": "application/json",
    vary: "Origin",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-allow-methods"] = "POST";
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function readStartRequest(request: IncomingMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      if (settled) return;
      body += chunk;
      if (body.length > 16) {
        settled = true;
        reject(new Error("Request body is too large."));
      }
    });
    request.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    request.once("end", () => {
      if (settled) return;
      settled = true;
      if (body !== "{}") {
        reject(new Error("Invalid Local Agent start request."));
        return;
      }
      resolve();
    });
  });
}

function getInstallRoot(): string {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "DevForgeAgent",
    );
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "DevForgeAgent");
  }
  return path.join(os.homedir(), ".local", "share", "DevForgeAgent");
}

async function fetchAgentFile(
  name: keyof typeof agentFiles,
  destination: string,
): Promise<void> {
  const existing = await fs
    .readFile(destination)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
  const expectedHash = agentFiles[name];
  if (
    existing &&
    createHash("sha256").update(existing).digest("hex").toUpperCase() ===
      expectedHash
  ) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let temporaryPath: string | undefined;
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/AungKoLin828/devforge-ai-tool/main/agent/src/${name}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(
        `Could not download Local Agent file '${name}' (HTTP ${response.status}).`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error(`Local Agent file '${name}' has no content.`);
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error(`Local Agent file '${name}' is too large.`);
      }
      chunks.push(Buffer.from(value));
    }
    const content = Buffer.concat(chunks, totalBytes);
    if (
      content.length === 0 ||
      createHash("sha256").update(content).digest("hex").toUpperCase() !==
        expectedHash
    ) {
      throw new Error(
        `Downloaded Local Agent file '${name}' failed its integrity check.`,
      );
    }

    temporaryPath = `${destination}.${process.pid}.${randomBytes(8).toString("hex")}.download`;
    await fs.writeFile(temporaryPath, content, { flag: "wx" });
    await fs.rename(temporaryPath, destination);
    temporaryPath = undefined;
  } finally {
    clearTimeout(timeout);
    if (temporaryPath) await fs.rm(temporaryPath, { force: true });
  }
}

function nodeMajorVersion(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--version"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new Error("Checking the Node.js version timed out."));
      }
    }, 5_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(
          new Error(`Node.js 22 LTS or newer is required. ${error.message}`),
        );
      }
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      const match = output.trim().match(/^v(\d+)\./);
      if (code !== 0 || !match) {
        reject(new Error("Could not determine the installed Node.js version."));
        return;
      }
      resolve(Number(match[1]));
    });
  });
}

async function isAgentRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${agentPort}/pair`, {
      headers: { Origin: "https://devforge-ai-tool.netlify.app" },
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      token?: string;
    };
    return (
      result.success === true &&
      typeof result.token === "string" &&
      result.token.length > 0
    );
  } catch {
    return false;
  }
}

async function waitForAgent(child: ReturnType<typeof spawn>): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isAgentRunning()) return;
    if (child.exitCode !== null) {
      throw new Error("The Local Agent exited before it started listening.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The Local Agent did not start listening within 10 seconds.");
}

async function installAndStartAgent(): Promise<void> {
  if (await isAgentRunning()) return;
  if ((await nodeMajorVersion()) < 22) {
    throw new Error(
      "Node.js 22 LTS or newer is required to run the Local Agent.",
    );
  }

  const installRoot = getInstallRoot();
  const sourceRoot = path.join(installRoot, "src");
  const workspaceRoot = path.join(os.homedir(), "CodeviaAI");
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
  await Promise.all(
    Object.keys(agentFiles).map((name) =>
      fetchAgentFile(name as keyof typeof agentFiles, path.join(sourceRoot, name)),
    ),
  );

  const child = spawn("node", [path.join(sourceRoot, "index.js")], {
    cwd: installRoot,
    detached: true,
    env: {
      ...process.env,
      CODEVIA_AGENT_PORT: String(agentPort),
      CODEVIA_AGENT_TOKEN: randomBytes(32).toString("hex"),
      DEVFORGE_AGENT_SILENT: "1",
      CODEVIA_WORKSPACE: workspaceRoot,
    },
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  await waitForAgent(child);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  output: vscode.OutputChannel,
): Promise<void> {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) {
    respond(response, 403, { error: "Origin is not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    if (request.headers["access-control-request-method"] !== "POST") {
      respond(response, 405, { error: "Method is not allowed." }, origin);
      return;
    }
    response.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST",
      "access-control-allow-private-network": "true",
      "access-control-max-age": "600",
      vary: "Origin",
    });
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/start") {
    respond(response, 404, { error: "Not found." }, origin);
    return;
  }

  try {
    await readStartRequest(request);
    startTask ??= installAndStartAgent().finally(() => {
      startTask = undefined;
    });
    await startTask;
    respond(response, 200, { success: true }, origin);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not start the Local Agent.";
    output.appendLine(`Local Agent setup failed: ${message}`);
    respond(response, 500, { error: message }, origin);
  }
}

export function startLocalAgentBridge(
  output: vscode.OutputChannel,
): vscode.Disposable {
  const server = createServer((request, response) => {
    void handleRequest(request, response, output);
  });
  server.on("error", (error) => {
    output.appendLine(`Local Agent connection helper failed: ${error.message}`);
  });
  server.listen(bridgePort, "127.0.0.1");
  return new vscode.Disposable(() => {
    if (server.listening) server.close();
  });
}
