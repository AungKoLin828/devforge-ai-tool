import http from "node:http";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./executor.js";
const port = Number(process.env.DEVFORGE_AGENT_PORT || 45821),
  token = process.env.DEVFORGE_AGENT_TOKEN || "change-this-local-pairing-token",
  root = process.env.DEVFORGE_WORKSPACE || path.join(os.homedir(), "DevForge");
await fs.mkdir(root, { recursive: true });
function ok(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "http://localhost:8888",
  });
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "http://localhost:8888",
      "access-control-allow-headers": "authorization,content-type",
    });
    return res.end();
  }
  if (req.headers.authorization !== `Bearer ${token}`)
    return ok(res, { error: "Unauthorized" }, 401);
  try {
    if (req.url === "/health")
      return ok(res, {
        ok: true,
        agent: "DevForge Agent",
        machine: os.hostname(),
        platform: process.platform,
        workspaceRoot: root,
      });
    if (req.url === "/run" && req.method === "POST") {
      let raw = "";
      for await (const c of req) raw += c;
      const b = JSON.parse(raw);
      return ok(res, {
        success: true,
        result: await runCommand(
          root,
          String(b.command),
          Number(b.timeoutMs || 120000),
        ),
      });
    }
    if (req.url?.startsWith("/file") && req.method === "GET") {
      const u = new URL(req.url, "http://localhost");
      const rel = u.searchParams.get("path") || "";
      const target = path.resolve(root, rel);
      if (target !== root && !target.startsWith(root + path.sep))
        throw new Error("Path blocked");
      return ok(res, {
        success: true,
        path: rel,
        content: await fs.readFile(target, "utf8"),
      });
    }
    return ok(res, { error: "Not found" }, 404);
  } catch (e) {
    return ok(
      res,
      { success: false, error: e instanceof Error ? e.message : "Agent error" },
      400,
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`DevForge Local Agent listening on http://127.0.0.1:${port}`),
);
