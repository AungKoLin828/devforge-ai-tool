import { prisma } from "./db.js";
import { decrypt, encrypt } from "./crypto.js";
const required = (n) => {
    const v = process.env[n];
    if (!v)
        throw new Error(`${n} is required`);
    return v;
};
export function githubOAuthConfig(origin) {
    const callbackPath = "/api/auth/github/callback";
    const isLocal = origin.hostname === "localhost" ||
        origin.hostname === "127.0.0.1" ||
        origin.hostname === "[::1]" ||
        origin.hostname === "::1";
    if (isLocal) {
        if (!process.env.GITHUB_LOCAL_CLIENT_ID || !process.env.GITHUB_LOCAL_CLIENT_SECRET) {
            throw new Error("Local GitHub sign-in requires GITHUB_LOCAL_CLIENT_ID and GITHUB_LOCAL_CLIENT_SECRET. Create a local GitHub OAuth App with callback http://localhost:8888/api/auth/github/callback and add its credentials to your local .env.");
        }
        return {
            clientId: process.env.GITHUB_LOCAL_CLIENT_ID,
            clientSecret: process.env.GITHUB_LOCAL_CLIENT_SECRET,
            callbackUrl: new URL(callbackPath, origin).href,
        };
    }
    const callbackUrl = required("GITHUB_CALLBACK_URL");
    let callback;
    try {
        callback = new URL(callbackUrl);
    }
    catch {
        throw new Error("GITHUB_CALLBACK_URL must be a valid absolute URL");
    }
    if (callback.origin !== origin.origin ||
        callback.pathname !== callbackPath ||
        callback.search ||
        callback.hash) {
        throw new Error(`GITHUB_CALLBACK_URL must match ${origin.origin}${callbackPath}`);
    }
    return {
        clientId: required("GITHUB_CLIENT_ID"),
        clientSecret: required("GITHUB_CLIENT_SECRET"),
        callbackUrl: callback.href,
    };
}
export function githubLoginUrl(state, config) {
    const p = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl,
        scope: "read:user user:email repo",
        state,
    });
    return `https://github.com/login/oauth/authorize?${p}`;
}
export async function exchange(code, config) {
    const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
        }),
    });
    const d = (await r.json());
    if (!r.ok || !d.access_token)
        throw new Error("GitHub token exchange failed");
    return d.access_token;
}
export async function githubUser(token) {
    const h = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
    };
    const [u, e] = await Promise.all([
        fetch("https://api.github.com/user", { headers: h }),
        fetch("https://api.github.com/user/emails", { headers: h }),
    ]);
    const user = (await u.json());
    const emails = (await e.json());
    const email = user.email ||
        emails.find((x) => x.primary)?.email ||
        emails[0]?.email ||
        null;
    return {
        id: String(user.id),
        login: user.login,
        name: user.name,
        email,
        avatarUrl: user.avatar_url,
    };
}
export async function upsertGithubUser(token, profile) {
    return prisma.user.upsert({
        where: { githubId: profile.id },
        update: {
            githubUsername: profile.login,
            githubName: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            githubAccessTokenEnc: encrypt(token),
        },
        create: {
            githubId: profile.id,
            githubUsername: profile.login,
            githubName: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            githubAccessTokenEnc: encrypt(token),
        },
    });
}
async function githubApi(token, endpoint, init = {}) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
        ...init,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(init.headers || {}),
        },
    });
    const result = (await response.json().catch(() => ({})));
    if (!response.ok) {
        const detail = typeof result.message === "string" ? result.message : "Unknown GitHub error";
        throw new Error(`GitHub API request failed (${response.status}): ${detail}`);
    }
    return result;
}
async function githubTokenForUser(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessTokenEnc: true },
    });
    if (!user?.githubAccessTokenEnc) {
        throw new Error("GitHub access is unavailable. Sign out and sign in again to refresh your repository permissions.");
    }
    return decrypt(user.githubAccessTokenEnc);
}
function validateRepositoryName(owner, repository) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) ||
        owner === "." ||
        owner === ".." ||
        !/^[A-Za-z0-9_.-]{1,100}$/.test(repository) ||
        repository === "." ||
        repository === "..") {
        throw new Error("Enter a valid GitHub owner and repository name");
    }
}
function repositoryPath(owner, repository) {
    validateRepositoryName(owner, repository);
    return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}
export async function listGitHubRepositories(userId) {
    const token = await githubTokenForUser(userId);
    const repositories = await githubApi(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
    return repositories
        .filter((repository) => repository.permissions?.push === true)
        .map((repository) => ({
        id: String(repository.id),
        name: repository.name,
        fullName: repository.full_name,
        private: repository.private,
        defaultBranch: repository.default_branch,
    }));
}
async function persistGitHubRepository(projectId, repository) {
    const [owner, name] = repository.full_name.split("/");
    if (!owner || !name || !repository.default_branch) {
        throw new Error("GitHub returned incomplete repository information");
    }
    await prisma.$transaction(async (tx) => {
        await tx.project.update({
            where: { id: projectId },
            data: {
                gitProvider: "GITHUB",
                githubOwner: owner,
                githubRepository: name,
                githubBranch: repository.default_branch,
                githubRepoId: String(repository.id),
                gitSyncStatus: "CONNECTED",
            },
        });
        await tx.gitRepository.upsert({
            where: {
                projectId_owner_repository: {
                    projectId,
                    owner,
                    repository: name,
                },
            },
            create: {
                projectId,
                owner,
                repository: name,
                githubRepoId: String(repository.id),
                defaultBranch: repository.default_branch,
                connected: true,
            },
            update: {
                githubRepoId: String(repository.id),
                defaultBranch: repository.default_branch,
                connected: true,
            },
        });
    });
    return {
        owner,
        repository: name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        private: repository.private,
    };
}
export async function connectGitHubRepository(projectId, userId, owner, repository) {
    const token = await githubTokenForUser(userId);
    const details = await githubApi(token, repositoryPath(owner, repository));
    if (details.permissions?.push !== true) {
        throw new Error("You need write access to connect this GitHub repository");
    }
    return persistGitHubRepository(projectId, details);
}
export async function createGitHubRepository(projectId, userId, name, description) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name) || name === "." || name === "..") {
        throw new Error("Repository name must use 1-100 letters, numbers, dots, dashes or underscores");
    }
    const token = await githubTokenForUser(userId);
    const repository = await githubApi(token, "/user/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            description: description.slice(0, 350),
            private: true,
            auto_init: false,
        }),
    });
    return persistGitHubRepository(projectId, repository);
}
export async function updateGitHubSync(projectId, userId, relativePath, status) {
    if (!relativePath ||
        relativePath.length > 512 ||
        relativePath.startsWith("/") ||
        relativePath.includes("\\") ||
        /^[a-z]:/i.test(relativePath) ||
        relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
        throw new Error("Local repository path must be relative to the agent workspace");
    }
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true, githubOwner: true, githubRepository: true },
    });
    if (!project)
        throw new Error("Project not found");
    if (!project.githubOwner || !project.githubRepository) {
        throw new Error("Connect a GitHub repository before synchronizing");
    }
    const lastSyncedAt = status === "CLEAN" ? new Date() : undefined;
    await prisma.$transaction([
        prisma.project.update({
            where: { id: projectId },
            data: { localPath: relativePath, gitSyncStatus: status, lastSyncedAt },
        }),
        prisma.gitRepository.updateMany({
            where: {
                projectId,
                owner: project.githubOwner,
                repository: project.githubRepository,
            },
            data: { lastSyncAt: lastSyncedAt },
        }),
    ]);
    return { localPath: relativePath, gitSyncStatus: status, lastSyncedAt };
}
