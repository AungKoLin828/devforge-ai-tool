import { prisma } from "./db.js";
import { encrypt } from "./crypto.js";
const required = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`${n} is required`);
  return v;
};
export function githubLoginUrl(state: string) {
  const p = new URLSearchParams({
    client_id: required("GITHUB_CLIENT_ID"),
    redirect_uri: required("GITHUB_CALLBACK_URL"),
    scope: "read:user user:email repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${p}`;
}
export async function exchange(code: string) {
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: required("GITHUB_CLIENT_ID"),
      client_secret: required("GITHUB_CLIENT_SECRET"),
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
