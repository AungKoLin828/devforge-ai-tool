import { prisma } from "./db.js";
import { encrypt } from "./crypto.js";
const required = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`${n} is required`);
  return v;
};
export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

export function githubOAuthConfig(origin: URL): GithubOAuthConfig {
  const callbackPath = "/api/auth/github/callback";
  const isLocal =
    origin.hostname === "localhost" ||
    origin.hostname === "127.0.0.1" ||
    origin.hostname === "[::1]" ||
    origin.hostname === "::1";

  if (isLocal) {
    if (!process.env.GITHUB_LOCAL_CLIENT_ID || !process.env.GITHUB_LOCAL_CLIENT_SECRET) {
      throw new Error(
        "Local GitHub sign-in requires GITHUB_LOCAL_CLIENT_ID and GITHUB_LOCAL_CLIENT_SECRET. Create a local GitHub OAuth App with callback http://localhost:8888/api/auth/github/callback and add its credentials to your local .env.",
      );
    }
    return {
      clientId: process.env.GITHUB_LOCAL_CLIENT_ID,
      clientSecret: process.env.GITHUB_LOCAL_CLIENT_SECRET,
      callbackUrl: new URL(callbackPath, origin).href,
    };
  }

  const callbackUrl = required("GITHUB_CALLBACK_URL");
  let callback: URL;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new Error("GITHUB_CALLBACK_URL must be a valid absolute URL");
  }
  if (
    callback.origin !== origin.origin ||
    callback.pathname !== callbackPath ||
    callback.search ||
    callback.hash
  ) {
    throw new Error(
      `GITHUB_CALLBACK_URL must match ${origin.origin}${callbackPath}`,
    );
  }
  return {
    clientId: required("GITHUB_CLIENT_ID"),
    clientSecret: required("GITHUB_CLIENT_SECRET"),
    callbackUrl: callback.href,
  };
}

export function githubLoginUrl(state: string, config: GithubOAuthConfig) {
  const p = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: "read:user user:email repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${p}`;
}
export async function exchange(code: string, config: GithubOAuthConfig) {
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });
  const d = (await r.json()) as any;
  if (!r.ok || !d.access_token) throw new Error("GitHub token exchange failed");
  return d.access_token as string;
}
export async function githubUser(token: string) {
  const h = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const [u, e] = await Promise.all([
    fetch("https://api.github.com/user", { headers: h }),
    fetch("https://api.github.com/user/emails", { headers: h }),
  ]);
  const user = (await u.json()) as any;
  const emails = (await e.json()) as any[];
  const email =
    user.email ||
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
export async function upsertGithubUser(token: string, profile: any) {
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
