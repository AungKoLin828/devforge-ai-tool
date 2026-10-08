import { prisma } from "./db.js";
import { generate, SYSTEM, type Provider } from "./ai.js";
export async function owner(id: string, userId: string) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new Error("Project not found");
  if (p.userId !== userId) throw new Error("Forbidden");
  return p;
}
export const list = (u: string) =>
  prisma.project.findMany({
    where: { userId: u },
    orderBy: { updatedAt: "desc" },
  });
export async function create(
  u: string,
  i: { name: string; description?: string; stack?: string },
) {
  const p = await prisma.project.create({
    data: {
      userId: u,
      name: i.name.trim().slice(0, 120),
      description: i.description?.trim(),
      stack: i.stack?.trim(),
    },
  });
  await prisma.projectMember.create({
    data: { projectId: p.id, userId: u, role: "OWNER" },
  });
  return p;
}
export async function generateProject(
  id: string,
  u: string,
  prompt: string,
  provider: Provider = "OPENROUTER",
) {
  const p = await owner(id, u);
  await prisma.project.update({
    where: { id },
    data: { status: "GENERATING" },
  });
  const run = await prisma.projectRun.create({
    data: {
      projectId: id,
      operation: "GENERATE",
      status: "RUNNING",
      input: { prompt, provider },
      startedAt: new Date(),
    },
  });
  const started = Date.now();
  try {
    const r = await generate(
      [
        {
          role: "system",
          content:
            SYSTEM +
            " Return JSON with requirements, architecture, database, api, plan, files.",
        },
        {
          role: "user",
          content: JSON.stringify({
            project: {
              name: p.name,
              description: p.description,
              stack: p.stack,
            },
            prompt,
          }),
        },
      ],
      provider,
    );
    let plan: any;
    try {
      plan = JSON.parse(r.text.replace(/^```json\s*|```$/g, ""));
    } catch {
      plan = {
        requirements: { summary: r.text },
        architecture: {},
        database: {},
        api: {},
        plan: [],
        files: [],
      };
    }
    const files = Array.isArray(plan.files) ? plan.files : [];
    const updated = await prisma.$transaction(async (tx) => {
      for (const [type, name, key] of [
        ["REQUIREMENTS", "requirements.json", "requirements"],
        ["ARCHITECTURE", "architecture.json", "architecture"],
        ["DATABASE", "database.json", "database"],
        ["API", "api.json", "api"],
      ] as const)
        await tx.artifact.create({
          data: { projectId: id, type, name, content: plan[key] || {} },
        });
      await tx.artifact.create({
        data: {
          projectId: id,
          type: "PLAN",
          name: "plan.json",
          content: plan.plan || [],
        },
      });
      await tx.artifact.create({
        data: {
          projectId: id,
          type: "CODE",
          name: "generated-files.json",
          content: files,
        },
      });
      await tx.projectRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          output: { files: files.length, usage: r.usage },
          finishedAt: new Date(),
        },
      });
      return tx.project.update({
        where: { id },
        data: { status: "READY", workspace: { files } },
      });
    });
    return { project: updated, files, latencyMs: Date.now() - started };
  } catch (e) {
    await prisma.projectRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: e instanceof Error ? e.message : "Generation failed",
        finishedAt: new Date(),
      },
    });
    await prisma.project.update({ where: { id }, data: { status: "FAILED" } });
    throw e;
  }
}
