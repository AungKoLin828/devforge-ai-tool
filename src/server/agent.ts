import { prisma } from "./db.js";

export async function ensureAgent(userId: string) {
  // Keep compatible with the current Prisma schema: LocalAgent does not
  // expose the createdAt field in the generated client used by this build.
  return prisma.localAgent.findFirst({
    where: { userId },
  });
}

export async function registerAgent(userId: string, input: any) {
  const agent = await prisma.localAgent.create({
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

  return agent;
}

export async function queueJob(
  userId: string,
  projectId: string,
  type: any,
  input: any,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.userId !== userId) {
    throw new Error("Forbidden");
  }

  const agent = await ensureAgent(userId);
  if (!agent) {
    throw new Error("No local agent paired");
  }

  return prisma.agentJob.create({
    data: {
      projectId,
      agentId: agent.id,
      type,
      input,
    },
  });
}

export async function claimJob(agentId: string) {
  const job = await prisma.agentJob.findFirst({
    where: {
      agentId,
      status: "QUEUED",
    },
  });

  if (!job) return null;

  return prisma.agentJob.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
}
