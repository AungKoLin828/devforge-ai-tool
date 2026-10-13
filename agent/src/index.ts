import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {
  listWorkspaceProjects,
  listWorkspaceEntries,
  readLocalProject,
  readWorkspaceFile,
  runCommand,
  runProjectAction,
  writeWorkspaceFile,
  writeProjectFiles,
} from "./executor.js";

const port = Number(process.env.DEVFORGE_AGENT_PORT || 45821);
const token = process.env.DEVFORGE_AGENT_TOKEN || randomBytes(32).toString("hex");
const root = process.env.DEVFORGE_WORKSPACE || path.join(os.homedir(), "DevForge");
const allowedOrigins = new Set([
  "http://localhost:8888",
  "http://localhost:5173",
  "https://devforge-ai-tool.netlify.app",
  ...(process.env.DEVFORGE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
const maxRequestBytes = 6 * 1024 * 1024;

await fs.mkdir(root, { recursive: true });

function respond(
  res: http.ServerResponse,
  data: unknown,
  status = 200,
  origin?: string,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "no-store",
    vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "authorization,content-type";
    headers["access-control-allow-methods"] = "GET,POST,OPTIONS";
  }

  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage) {
  let raw = "";
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > maxRequestBytes) {
      throw new Error("Request body exceeds the 6 MB limit");
    }
    raw += chunk;
  }
  return JSON.parse(raw || "{}");
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) {
      res.writeHead(403, { vary: "Origin" });
      return res.end();
    }

    res.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-max-age": "600",
      "access-control-allow-private-network": "true",
      vary: "Origin",
    });
    return res.end();
  }

  if (origin && !allowedOrigins.has(origin)) {
    return respond(res, { error: "Origin is not allowed" }, 403, origin);
  }

  if (req.headers.authorization !== `Bearer ${token}`) {
    return respond(res, { error: "Unauthorized" }, 401, origin);
  }

  try {
    if (req.url === "/health" && req.method === "GET") {
      return respond(
        res,
        {
          ok: true,
          agent: "DevForge Agent",
          machine: os.hostname(),
          platform: process.platform,
          workspaceRoot: root,
        },
        200,
        origin,
      );
    }

    if (req.url === "/workspace/projects" && req.method === "GET") {
      return respond(
        res,
        { success: true, projects: await listWorkspaceProjects(root) },
        200,
        origin,
      );
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    if (requestUrl.pathname === "/workspace/files" && req.method === "GET") {
      return respond(
        res,
        {
          success: true,
          ...(await listWorkspaceEntries(
            root,
            requestUrl.searchParams.get("path") || "",
          )),
        },
        200,
        origin,
      );
    }

    if (requestUrl.pathname === "/workspace/file" && req.method === "GET") {
      return respond(
        res,
        {
          success: true,
          file: await readWorkspaceFile(
            root,
            requestUrl.searchParams.get("path") || "",
          ),
        },
        200,
        origin,
      );
    }

    if (req.url === "/workspace/file" && req.method === "POST") {
      const body = await readBody(req);
      return respond(
        res,
        {
          success: true,
          file: await writeWorkspaceFile(
            root,
            String(body.path || ""),
            body.content,
            Number(body.expectedModifiedAt),
          ),
        },
        200,
        origin,
      );
    }

    if (req.url === "/workspace/import" && req.method === "POST") {
      const body = await readBody(req);
      return respond(
        res,
        {
          success: true,
          project: await readLocalProject(root, String(body.path || "")),
        },
        200,
        origin,
      );
    }

    if (req.url === "/run" && req.method === "POST") {
      const body = await readBody(req);
      return respond(
        res,
        {
          success: true,
          result: await runCommand(
            root,
            String(body.command),
            Math.min(Number(body.timeoutMs || 120000), 10 * 60 * 1000),
          ),
        },
        200,
        origin,
      );
    }

    if (req.url === "/project/sync" && req.method === "POST") {
      const body = await readBody(req);
      const result = await writeProjectFiles(
        root,
        String(body.path || ""),
        body.files,
      );
      return respond(res, { success: true, ...result }, 200, origin);
    }

    if (
      (req.url === "/project/build" || req.url === "/project/test") &&
      req.method === "POST"
    ) {
      const body = await readBody(req);
      const action = req.url === "/project/build" ? "build" : "test";
      const result = await runProjectAction(root, String(body.path || ""), action);
      return respond(res, { success: true, result }, 200, origin);
    }

    return respond(res, { error: "Not found" }, 404, origin);
  } catch (cause) {
    return respond(
      res,
      {
        success: false,
        error: cause instanceof Error ? cause.message : "Agent error",
      },
      400,
      origin,
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `DevForge Local Agent listening on http://127.0.0.1:${port}\nPairing token: ${token}`,
  );
});
