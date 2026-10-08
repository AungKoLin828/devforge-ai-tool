import { json, error, body } from "./http.js";
import { requireAuth, AuthError, createSession, clearSession } from "./auth.js";
import {
  githubLoginUrl,
  exchange,
  githubUser,
  upsertGithubUser,
} from "./github.js";
import { randomToken, sha256 } from "./crypto.js";
import { prisma } from "./db.js";
import { create, list, owner, generateProject } from "./projects.js";
import { ensureAgent, registerAgent, queueJob, claimJob } from "./agent.js";
const redirect = (url: string, status = 302) =>
  new Response(null, { status, headers: { Location: url } });
export async function handleApi(req: Request) {
  try {
    const u = new URL(req.url),
      path = u.pathname.replace(/^\/api\/?/, "");
    if (path === "auth/github" && req.method === "GET") {
      const state = randomToken();
      const cookie = `devforge_oauth=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
      const r = redirect(githubLoginUrl(state), 302);
      r.headers.set("set-cookie", cookie);
      return r;
    }
    if (path === "auth/github/callback" && req.method === "GET") {
      const code = u.searchParams.get("code"),
        state = u.searchParams.get("state");
      const cookie = req.headers.get("cookie") || "";
      const expected = cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("devforge_oauth="))
        ?.slice("devforge_oauth=".length);
      if (!code || !state || !expected || state !== expected)
        return error("Invalid OAuth state", 400);
      const token = await exchange(code);
      const profile = await githubUser(token);
      const user = await upsertGithubUser(token, profile);
      const cookie = await createSession({
        id: user.id,
        githubUsername: user.githubUsername,
        githubName: user.githubName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
      return new Response(null, {
        status: 302,
        headers: { Location: process.env.APP_URL || "/", "Set-Cookie": cookie },
      });
    }
    if (path === "auth/logout" && req.method === "POST") {
      const user = await requireAuth(req).catch(() => null);
      if (user) await prisma.session.deleteMany({ where: { userId: user.id } });
      return json({ success: true }, 200, { "set-cookie": clearSession() });
    }
    if (path === "auth/me" && req.method === "GET") {
      const u = await requireAuth(req);
      return json({ success: true, user: u });
    }
    const user = await requireAuth(req);
    if (path === "projects" && req.method === "GET")
      return json({ success: true, projects: await list(user.id) });
    if (path === "projects" && req.method === "POST")
      return json(
        { success: true, project: await create(user.id, await body<any>(req)) },
        201,
      );
    const m = path.match(/^projects\/([^/]+)(?:\/(.+))?$/);
    if (m) {
      const id = m[1],
        action = m[2];
      if (!action && req.method === "GET")
        return json({ success: true, project: await owner(id, user.id) });
      if (action === "generate" && req.method === "POST") {
        const b = await body<any>(req);
        return json({
          success: true,
          ...(await generateProject(
            id,
            user.id,
            String(b.prompt || ""),
            b.provider || "OPENROUTER",
          )),
        });
      }
      if (action === "jobs" && req.method === "POST") {
        const b = await body<any>(req);
        return json(
          {
            success: true,
            job: await queueJob(user.id, id, b.type, b.input || {}),
          },
          201,
        );
      }
      if (action === "history" && req.method === "GET")
        return json({
          success: true,
          runs: await prisma.projectRun.findMany({
            where: { projectId: id },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
    }
    if (path === "agent" && req.method === "GET")
      return json({ success: true, agent: await ensureAgent(user.id) });
    if (path === "agent/register" && req.method === "POST")
      return json(
        {
          success: true,
          agent: await registerAgent(user.id, await body<any>(req)),
        },
        201,
      );
    if (path === "agent/job/claim" && req.method === "POST") {
      const a = await ensureAgent(user.id);
      if (!a) return error("No agent", 404);
      return json({ success: true, job: await claimJob(a.id) });
    }
    if (path === "agent/job/result" && req.method === "POST") {
      const b = await body<any>(req);
      const a = await ensureAgent(user.id);
      if (!a) return error("No agent", 404);
      const job = await prisma.agentJob.findFirst({
        where: { id: b.jobId, agentId: a.id },
      });
      if (!job) return error("Job not found", 404);
      const done = await prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: b.success ? "SUCCESS" : "FAILED",
          output: b.output,
          error: b.error,
          finishedAt: new Date(),
        },
      });
      return json({ success: true, job: done });
    }
    if (path === "ai/providers" && req.method === "GET")
      return json({
        success: true,
        providers: await prisma.aiProvider.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            provider: true,
            label: true,
            enabled: true,
            model: true,
            baseUrl: true,
          },
        }),
      });
    return error("Not found", 404);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    return error(e instanceof Error ? e.message : "Internal server error", 500);
  }
}
