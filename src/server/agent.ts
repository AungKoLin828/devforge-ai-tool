import { prisma } from "./db.js";
export async function ensureAgent(userId: string) {
  return prisma.localAgent.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}
export async function registerAgent(userId: string, input: any) {
  const a = await prisma.localAgent.create({
    data: {
      userId,
      agentName: String(input.agentName || "DevForge Agent"),
      machineName: input.machineName,
      platform: input.platform,
      architecture: input.architecture,
      version: input.version,
      workspaceRoot: input.workspaceRoot,
      capabilities: input.capabilities,
      tokenHash: input.tokenHash,
      pairedAt: new Date(),
    },
  });
  return a;
}
export async function queueJob(
  userId: string,
  projectId: string,
  type: any,
  input: any,
) {
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  if (!p || p.userId !== userId) throw new Error("Forbidden");
  const a = await ensureAgent(userId);
  if (!a) throw new Error("No local agent paired");
  return prisma.agentJob.create({
    data: { projectId, agentId: a.id, type, input },
  });
}
export async function claimJob(agentId: string) {
  const job = await prisma.agentJob.findFirst({
    where: { agentId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return null;
  return prisma.agentJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}
