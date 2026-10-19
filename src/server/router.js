import { json, error, body } from "./http.js";
import { requireAuth, AuthError, createSession, clearSession, } from "./auth.js";
import { githubOAuthConfig, githubLoginUrl, exchange, githubUser, upsertGithubUser, listGitHubRepositories, connectGitHubRepository, createGitHubRepository, disconnectGitHubRepository, updateGitHubSync, } from "./github.js";
import { randomToken } from "./crypto.js";
import { prisma } from "./db.js";
import { deleteAIProvider, listAIProviders, saveAIProvider, } from "./ai.js";
import { create, chatWithProject, detail, importProject, list, owner, rename, remove, removeImportedProject, startGenerateProject, startReviewProject, } from "./projects.js";
import { ensureAgent, registerAgent, queueJob, claimJob, } from "./agent.js";
// Keep OAuth redirects as minimal responses with an explicit status.
const redirect = (url, status = 302) => new Response(null, {
    status,
    headers: { Location: url },
});
function isAIProvider(value) {
    return value === "OPENROUTER" || value === "OPENAI" || value === "CUSTOM";
}
// Normalize expected and unexpected errors before returning them to API clients.
function getErrorInfo(caught) {
    let current = caught;
    let message = "";
    let code = "";
    const seen = new Set();
    while (current && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        const details = current;
        if (!message && typeof details.message === "string") {
            message = details.message.trim();
        }
        if (!code && typeof details.code === "string") {
            code = details.code;
        }
        current = details.cause;
    }
    return { message, code };
}
/** Dispatch one authenticated or public API request to its route handler. */
export async function handleApi(req) {
    try {
        // Normalize the API path once; route matching below uses the path without /api.
        const url = new URL(req.url);
        const path = url.pathname.replace(/^\/api\/?/, "");
        // OAuth entry and callback are public routes; the callback validates state before exchange.
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
            // All project and repository data routes require a valid session.
            const user = await requireAuth(req);
            return json({ success: true, user });
        }
        const user = await requireAuth(req);
        const aiProviderMatch = path.match(/^ai\/providers\/(OPENROUTER|OPENAI|CUSTOM)$/);
        if (aiProviderMatch && req.method === "PUT") {
            const provider = aiProviderMatch[1];
            const requestBody = await body(req);
            if ((requestBody.apiKey !== undefined &&
                (typeof requestBody.apiKey !== "string" ||
                    requestBody.apiKey.length > 4096)) ||
                (requestBody.model !== undefined &&
                    (typeof requestBody.model !== "string" ||
                        requestBody.model.length > 200)) ||
                (requestBody.baseUrl !== undefined &&
                    (typeof requestBody.baseUrl !== "string" ||
                        requestBody.baseUrl.length > 2048))) {
                return error("AI provider settings contain invalid values", 400);
            }
            await saveAIProvider(user.id, provider, {
                apiKey: requestBody.apiKey,
                model: requestBody.model,
                baseUrl: requestBody.baseUrl,
            });
            const providerInfo = (await listAIProviders(user.id)).find((item) => item.provider === provider);
            if (!providerInfo)
                throw new Error("Could not load saved AI provider settings.");
            return json({ success: true, provider: providerInfo });
        }
        if (aiProviderMatch && req.method === "DELETE") {
            await deleteAIProvider(user.id, aiProviderMatch[1]);
            return json({ success: true });
        }
        if (path === "github/repositories" && req.method === "GET") {
            return json({
                success: true,
                repositories: await listGitHubRepositories(user.id),
            });
        }
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
        // Importing accepts only the bounded file snapshot validated by the project service.
        if (path === "projects/import" && req.method === "POST") {
            return json({
                success: true,
                project: await importProject(user.id, await body(req)),
            }, 201);
        }
        const match = path.match(/^projects\/([^/]+)(?:\/(.+))?$/);
        if (match) {
            // Project subroutes share an owner check before accessing private project data.
            const projectId = match[1];
            const action = match[2];
            // GitHub routes update only DevForge's link metadata, never the remote itself.
            if (action === "github/connect" && req.method === "POST") {
                await owner(projectId, user.id);
                const requestBody = await body(req);
                if (typeof requestBody.owner !== "string" ||
                    typeof requestBody.repository !== "string" ||
                    !/^[A-Za-z0-9_.-]{1,100}$/.test(requestBody.owner.trim()) ||
                    !/^[A-Za-z0-9_.-]{1,100}$/.test(requestBody.repository.trim()) ||
                    requestBody.owner.trim() === "." ||
                    requestBody.owner.trim() === ".." ||
                    requestBody.repository.trim() === "." ||
                    requestBody.repository.trim() === "..") {
                    return error("Enter a valid GitHub owner and repository name", 400);
                }
                return json({
                    success: true,
                    repository: await connectGitHubRepository(projectId, user.id, requestBody.owner.trim(), requestBody.repository.trim()),
                });
            }
            if (action === "github/create" && req.method === "POST") {
                await owner(projectId, user.id);
                const requestBody = await body(req);
                if (typeof requestBody.name !== "string" ||
                    !/^[A-Za-z0-9_.-]{1,100}$/.test(requestBody.name.trim()) ||
                    requestBody.name.trim() === "." ||
                    requestBody.name.trim() === "..") {
                    return error("Repository name must use 1-100 letters, numbers, dots, dashes or underscores", 400);
                }
                if (requestBody.private !== undefined &&
                    typeof requestBody.private !== "boolean") {
                    return error("Repository visibility must be private or public", 400);
                }
                return json({
                    success: true,
                    repository: await createGitHubRepository(projectId, user.id, requestBody.name.trim(), typeof requestBody.description === "string"
                        ? requestBody.description.trim()
                        : "", requestBody.private !== false),
                }, 201);
            }
            if (action === "github/status" && req.method === "POST") {
                await owner(projectId, user.id);
                const requestBody = await body(req);
                if (typeof requestBody.path !== "string" ||
                    !requestBody.path ||
                    requestBody.path.length > 512 ||
                    requestBody.path.startsWith("/") ||
                    requestBody.path.includes("\\") ||
                    /^[a-z]:/i.test(requestBody.path) ||
                    requestBody.path.split("/").some((part) => !part || part === "." || part === "..") ||
                    (requestBody.status !== "CONNECTED" &&
                        requestBody.status !== "CLEAN" &&
                        requestBody.status !== "ERROR")) {
                    return error("A valid local repository path and sync status are required", 400);
                }
                return json({
                    success: true,
                    ...await updateGitHubSync(projectId, user.id, requestBody.path, requestBody.status),
                });
            }
            if (action === "github/disconnect" && req.method === "POST") {
                await disconnectGitHubRepository(projectId, user.id);
                return json({ success: true });
            }
            // This action is intentionally separate from permanent project deletion.
            if (action === "import/remove" && req.method === "POST") {
                await removeImportedProject(projectId, user.id);
                return json({ success: true });
            }
            if (action === "rename" && req.method === "PATCH") {
                const requestBody = await body(req);
                if (typeof requestBody.name !== "string" ||
                    !requestBody.name.trim() ||
                    requestBody.name.trim().length > 120) {
                    return error("Project name must be between 1 and 120 characters", 400);
                }
                return json({
                    success: true,
                    project: await rename(projectId, user.id, requestBody.name.trim()),
                });
            }
            // Base project routes read details or perform the explicitly requested deletion.
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
            // Long-running AI work is enqueued and reported through a pollable run ID.
            if ((action === "generate" || action === "modify") &&
                req.method === "POST") {
                const requestBody = await body(req);
                const provider = requestBody.provider || "OPENROUTER";
                if (!isAIProvider(provider)) {
                    return error("Unsupported AI provider", 400);
                }
                const result = await startGenerateProject(projectId, user.id, String(requestBody.prompt || ""), provider, action);
                // Return immediately. The AI generation runs in the
                // Netlify Background Function.
                return json({
                    success: true,
                    ...result,
                }, 202);
            }
            if (action === "review" && req.method === "POST") {
                const requestBody = await body(req);
                const provider = requestBody.provider || "OPENROUTER";
                if (!isAIProvider(provider)) {
                    return error("Unsupported AI provider", 400);
                }
                const result = await startReviewProject(projectId, user.id, provider);
                return json({
                    success: true,
                    ...result,
                }, 202);
            }
            if (action === "chat" && req.method === "POST") {
                const requestBody = await body(req);
                const provider = requestBody.provider || "OPENROUTER";
                if (!isAIProvider(provider)) {
                    return error("Unsupported AI provider", 400);
                }
                return json({
                    success: true,
                    ...(await chatWithProject(projectId, user.id, requestBody.messages, provider)),
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
                providers: await listAIProviders(user.id),
            });
        }
        return error("Not found", 404);
    }
    catch (caught) {
        if (caught instanceof AuthError) {
            return error(caught.message, caught.status);
        }
        const { code, message: originalMessage } = getErrorInfo(caught);
        let message = originalMessage || "Internal server error";
        if (code === "P2021" ||
            code === "42P01" ||
            message.includes('The table `public.User` does not exist')) {
            message =
                'The configured database is missing public."User". Verify the target with `npm run db:check`. Apply `npm run prisma:deploy` only if the database is empty; for a manually created or partially initialized schema, add the missing tables without rerunning the full initial migration.';
        }
        else if (code === "ETIMEDOUT" ||
            code === "ECONNREFUSED" ||
            code === "P1001" ||
            message.toLowerCase().includes("timed out")) {
            message =
                "The local server timed out connecting to Supabase PostgreSQL. Verify that your network, VPN, and firewall allow outbound TCP to the Supabase database on the port in DATABASE_URL (usually 5432 for the session pooler or 6543 for the transaction pooler), then run `npm run db:check`.";
        }
        else if (!originalMessage) {
            message = `The database request failed${code ? ` (${code})` : ""}. Run \`npm run db:check\` to verify the local database connection and schema.`;
        }
        if (message === "Forbidden")
            return error(message, 403);
        if (message === "Project not found")
            return error(message, 404);
        if (message.includes("already running")) {
            return error(message, 409);
        }
        if (message.includes("required") ||
            message.includes("30,000 characters") ||
            message.includes("200 characters or fewer") ||
            message.includes("public HTTPS") ||
            message.includes("public DNS hostname") ||
            message.includes("public IP addresses") ||
            message.includes("could not be resolved") ||
            message.includes("without credentials, query, or fragment") ||
            message.includes("Model name") ||
            message.includes("not configured") ||
            message.includes("disabled in your AI provider settings") ||
            message.includes("Unsupported AI provider") ||
            message.startsWith("Chat ")) {
            return error(message, 400);
        }
        console.error("API request failed", message);
        return error(message, 500);
    }
}
