import { prisma } from "./db.js";
import { randomToken, sha256 } from "./crypto.js";

// Cookie and session policy shared by API authentication routes.
const COOKIE = "devforge_session";
const days = 30;

/** Minimal public profile fields exposed to the client after authentication. */
export type AuthUser = {
  id: string;
  githubUsername: string | null;
  githubName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

// Store only the hash in PostgreSQL; the raw session token stays in the browser cookie.
function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
}

/** Create a persisted session and return its HTTP Set-Cookie value. */
export async function createSession(user: AuthUser) {
  const raw = randomToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + days * 86400000),
    },
  });
  return cookie(raw, days * 86400);
}

/** Return a Set-Cookie value that immediately expires the current session cookie. */
export function clearSession() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
}

// Parse the session cookie without depending on a framework-specific cookie API.
function get(req: Request) {
  const c = req.headers.get("cookie") || "";
  const p = c
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="));
  return p ? decodeURIComponent(p.slice(COOKIE.length + 1)) : null;
}

/** Validate the session, update its activity timestamp, and return its user. */
export async function requireAuth(req: Request) {
  const raw = get(req);
  if (!raw) throw new AuthError("Authentication required", 401);
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!s || s.expiresAt <= new Date())
    throw new AuthError("Session expired", 401);
  await prisma.session.update({
    where: { id: s.id },
    data: { lastSeenAt: new Date() },
  });
  return s.user;
}

/** HTTP-aware authentication failure that the router can serialize consistently. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}
