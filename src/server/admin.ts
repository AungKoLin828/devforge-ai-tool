import { prisma } from "./db.js";
import type { UserRole } from "../generated/prisma/client.js";

/** Admin page list entry: one platform user with usage counts. */
export type AdminUserRow = {
  id: string;
  githubId: string;
  githubUsername: string | null;
  githubName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isBlocked: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  projectCount: number;
  sessionCount: number;
};

/** List every registered user of the web app and VS Code extension. */
export async function listUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { projects: true, sessions: true } },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
    },
  });
  return users.map((user) => ({
    id: user.id,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    githubName: user.githubName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    lastSeenAt: user.sessions[0]?.lastSeenAt ?? null,
    projectCount: user._count.projects,
    sessionCount: user._count.sessions,
  }));
}

/** Change a user's platform role. An admin can never demote themselves. */
export async function setRole(
  id: string,
  actingUserId: string,
  role: UserRole,
) {
  if (id === actingUserId && role !== "ADMIN") {
    throw new Error("Admins cannot remove their own admin role");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");
  return prisma.user.update({ where: { id }, data: { role } });
}

/** Block or unblock a user. An admin can never block themselves. */
export async function setBlocked(
  id: string,
  actingUserId: string,
  isBlocked: boolean,
) {
  if (id === actingUserId && isBlocked) {
    throw new Error("Admins cannot block their own account");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");
  const updated = await prisma.user.update({
    where: { id },
    data: { isBlocked },
  });
  if (isBlocked) {
    // Blocking ends every active session for the web app and the extension.
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.pairing.deleteMany({ where: { userId: id } });
  }
  return updated;
}

/** Remove a user and all cascaded DevForge records after explicit confirmation. */
export async function deleteUser(id: string, actingUserId: string) {
  if (id === actingUserId) {
    throw new Error("Admins cannot delete their own account");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");
  await prisma.user.delete({ where: { id } });
}

/** Simple platform usage counters shown at the top of the admin page. */
export async function adminStats() {
  const [users, projects, aiRequests, activeSessions] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.aIRequest.count(),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);
  return { users, projects, aiRequests, activeSessions };
}
