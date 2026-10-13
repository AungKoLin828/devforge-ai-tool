import { json, error, body } from "./http.js";
import { requireAuth, AuthError, createSession, clearSession, } from "./auth.js";
import { githubOAuthConfig, githubLoginUrl, exchange, githubUser, upsertGithubUser, } from "./github.js";
import { randomToken } from "./crypto.js";
import { prisma } from "./db.js";
import { create, chatWithProject, detail, importProject, list, owner, remove, startGenerateProject, startReviewProject, } from "./projects.js";
import { ensureAgent, registerAgent, queueJob, claimJob, } from "./agent.js";
const redirect = (url, status = 302) => new Response(null, {
    status,
    headers: { Location: url },
});
export async function handleApi(req) {
    try {
        const url = new URL(req.url);
        const path = url.pathname.replace(/^\/api\/?/, "");
        if (path === "auth/github" && req.method === "GET") {
            let oauthConfig;
            try {
                oauthConfig = githubOAuthConfig(url);
            }
            catch (cause) {
                return error(cause instanceof Error
                    ? cause.message
                    : "GitHub OAuth is not configured for this site", 500);
            }
            const state = randomToken();
            const secure = url.protocol === "https:" ? " Secure;" : "";
            const oauthCookie = `devforge_oauth=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600;${secure}`;
            const response = redirect(githubLoginUrl(state, oauthConfig));
            response.headers.set("set-cookie", oauthCookie);
            return response;
        }
        if (path === "auth/github/callback" && req.method === "GET") {
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const requestCookie = req.headers.get("cookie") || "";
            const expected = requestCookie
                .split(";")
                .map((item) => item.trim())
                .find((item) => item.startsWith("devforge_oauth="))
                ?.slice("devforge_oauth=".length);
            if (!code) {
                return error("GitHub did not return an authorization code. Start sign-in again.", 400);
            }
            if (!state) {
                return error("GitHub did not return OAuth state. Start sign-in again from the same site.", 400);
            }
            if (!expected) {
                return error("The OAuth state cookie is missing. Start sign-in from this same site (localhost or the deployed site) and allow cookies; do not open the callback URL directly.", 400);
            }
            if (state !== expected) {
                return error("OAuth state did not match. Sign-in started on a different site or an older login attempt was reused. Start again from the same site.", 400);
            }
            let oauthConfig;
            try {
                oauthConfig = githubOAuthConfig(url);
            }
            catch (cause) {
                return error(cause instanceof Error
                    ? cause.message
                    : "GitHub OAuth is not configured for this site", 500);
            }
            const token = await exchange(code, oauthConfig);
            const profile = await githubUser(token);
            const user = await upsertGithubUser(token, profile);
            const sessionCookie = await createSession({
                id: user.id,
                githubUsername: user.githubUsername,
                githubName: user.githubName,
                email: user.email,
                avatarUrl: user.avatarUrl,
            });
            const localHost = url.hostname === "localhost" ||
                url.hostname === "127.0.0.1" ||
                url.hostname === "[::1]" ||
                url.hostname === "::1";
            return new Response(null, {
                status: 302,
                headers: {
                    Location: localHost ? `${url.origin}/` : process.env.APP_URL || "/",
                    "Set-Cookie": sessionCookie,
                },
            });
        }
        if (path === "auth/logout" && req.method === "POST") {
            const user = await requireAuth(req).catch(() => null);
            if (user) {
                await prisma.session.deleteMany({
                    where: { userId: user.id },
                });
            }
            return json({ success: true }, 200, { "set-cookie": clearSession() });
        }
        if (path === "auth/me" && req.method === "GET") {
            const user = await requireAuth(req);
            return json({ success: true, user });
        }
        const user = await requireAuth(req);
        if (path === "projects" && req.method === "GET") {
            return json({
                success: true,
                projects: await list(user.id),
            });
        }
        if (path === "projects" && req.method === "POST") {
            return json({
                success: true,
                project: await create(user.id, await body(req)),
            }, 201);
        }
        if (path === "projects/import" && req.method === "POST") {
            return json({
                success: true,
                project: await importProject(user.id, await body(req)),
            }, 201);
        }
        const match = path.match(/^projects\/([^/]+)(?:\/(.+))?$/);
        if (match) {
            const projectId = match[1];
            const action = match[2];
            if (!action && req.method === "GET") {
                return json({
                    success: true,
                    project: await detail(projectId, user.id),
                });
            }
            if (!action && req.method === "DELETE") {
                await remove(projectId, user.id);
                return json({ success: true });
            }
            if (action === "generate" && req.method === "POST") {
                const requestBody = await body(req);
                const provider = requestBody.provider || "OPENROUTER";
                if (provider !== "OPENROUTER") {
                    return error("Unsupported AI provider", 400);
                }
                const result = await startGenerateProject(projectId, user.id, String(requestBody.prompt || ""), provider);
                // Return immediately. The AI generation runs in the
                // Netlify Background Function.
                return json({
                    success: true,
                    ...result,
                }, 202);
            }
            if (action === "review" && req.method === "POST") {
                const result = await startReviewProject(projectId, user.id);
                return json({
                    success: true,
                    ...result,
                }, 202);
            }
            if (action === "chat" && req.method === "POST") {
                const requestBody = await body(req);
                return json({
                    success: true,
                    ...(await chatWithProject(projectId, user.id, requestBody.messages)),
                });
            }
            // GET /api/projects/:projectId/runs/:runId
            const runMatch = action?.match(/^runs\/([^/]+)$/);
            if (runMatch && req.method === "GET") {
                // Verify project ownership before returning run details.
                await owner(projectId, user.id);
                const run = await prisma.projectRun.findFirst({
                    where: {
                        id: runMatch[1],
                        projectId,
                    },
                });
                if (!run)
                    return error("Generation run not found", 404);
                return json({
                    success: true,
                    run,
                });
            }
            if (action === "jobs" && req.method === "POST") {
                const requestBody = await body(req);
                return json({
                    success: true,
                    job: await queueJob(user.id, projectId, requestBody.type, requestBody.input || {}),
                }, 201);
            }
            if (action === "history" && req.method === "GET") {
                await owner(projectId, user.id);
                return json({
                    success: true,
                    runs: await prisma.projectRun.findMany({
                        where: { projectId },
                        orderBy: { createdAt: "desc" },
                        take: 100,
                    }),
                });
            }
        }
        if (path === "agent" && req.method === "GET") {
            return json({
                success: true,
                agent: await ensureAgent(user.id),
            });
        }
        if (path === "agent/register" && req.method === "POST") {
            return json({
                success: true,
                agent: await registerAgent(user.id, await body(req)),
            }, 201);
        }
        if (path === "agent/job/claim" && req.method === "POST") {
            const agent = await ensureAgent(user.id);
            if (!agent)
                return error("No agent", 404);
            return json({
                success: true,
                job: await claimJob(agent.id),
            });
        }
        if (path === "agent/job/result" && req.method === "POST") {
            const requestBody = await body(req);
            const agent = await ensureAgent(user.id);
            if (!agent)
                return error("No agent", 404);
            const job = await prisma.agentJob.findFirst({
                where: {
                    id: requestBody.jobId,
                    agentId: agent.id,
                },
            });
            if (!job)
                return error("Job not found", 404);
            const completedJob = await prisma.agentJob.update({
                where: { id: job.id },
                data: {
                    status: requestBody.success ? "SUCCESS" : "FAILED",
                    output: requestBody.output,
                    error: requestBody.error,
                    finishedAt: new Date(),
                },
            });
            return json({
                success: true,
                job: completedJob,
            });
        }
        if (path === "ai/providers" && req.method === "GET") {
            return json({
                success: true,
                providers: await prisma.aIProvider.findMany({
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
        }
        return error("Not found", 404);
    }
    catch (caught) {
        if (caught instanceof AuthError) {
            return error(caught.message, caught.status);
        }
        const message = caught instanceof Error
            ? caught.message
            : "Internal server error";
        if (message === "Forbidden")
            return error(message, 403);
        if (message === "Project not found")
            return error(message, 404);
        if (message.includes("already running")) {
            return error(message, 409);
        }
        if (message.includes("required") ||
            message.includes("30,000 characters") ||
            message.includes("Unsupported AI provider") ||
            message.startsWith("Chat ")) {
            return error(message, 400);
        }
        console.error("API request failed", message);
        return error(message, 500);
    }
}
