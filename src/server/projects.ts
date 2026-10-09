import { prisma } from "./db.js";
import { generate, SYSTEM, type Provider } from "./ai.js";

export async function owner(id: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) throw new Error("Project not found");
  if (project.userId !== userId) throw new Error("Forbidden");

  return project;
}

export const list = (userId: string) =>
  prisma.project.findMany({
    where: { userId },
  });

export async function create(
  userId: string,
  input: { name: string; description?: string; stack?: string },
) {
  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name.trim().slice(0, 120),
      description: input.description?.trim(),
      stack: input.stack?.trim(),
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId,
      role: "OWNER",
    },
  });

  return project;
}

export async function generateProject(
  id: string,
  userId: string,
  prompt: string,
  provider: Provider = "OPENROUTER",
) {
  const project = await owner(id, userId);

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
    const result = await generate(
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
              name: project.name,
              description: project.description,
              stack: project.stack,
            },
            prompt,
          }),
        },
      ],
      provider,
    );

    let plan: any;
    try {
      plan = JSON.parse(result.text.replace(/^```json\s*|```$/g, ""));
    } catch {
      plan = {
        requirements: { summary: result.text },
        architecture: {},
        database: {},
        api: {},
        plan: [],
        files: [],
      };
    }

    const files = Array.isArray(plan.files) ? plan.files : [];

    const updatedProject = await prisma.$transaction(async (tx) => {
      for (const [type, name, key] of [
        ["REQUIREMENTS", "requirements.json", "requirements"],
        ["ARCHITECTURE", "architecture.json", "architecture"],
        ["DATABASE", "database.json", "database"],
        ["API", "api.json", "api"],
      ] as const) {
        await tx.artifact.create({
          data: {
            projectId: id,
            type,
            name,
            content: plan[key] || {},
          },
        });
      }

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
          output: { files: files.length, usage: result.usage },
          finishedAt: new Date(),
        },
      });

      // Do not write `workspace`: it is not present in the current generated
      // Prisma Project type. Generated file data is persisted in Artifact.
      return tx.project.update({
        where: { id },
        data: { status: "READY" },
      });
    });

    return {
      project: updatedProject,
      files,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    await prisma.projectRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Generation failed",
        finishedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id },
      data: { status: "FAILED" },
    });

    throw error;
  }
}
