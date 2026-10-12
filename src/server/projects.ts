
import { prisma } from "./db.js";
import { generate, SYSTEM, type Provider } from "./ai.js";

const BACKGROUND_FUNCTION_PATH =
  "/.netlify/functions/generate-project-background";

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
    orderBy: { updatedAt: "desc" },
  });

export async function create(
  userId: string,
  input: {
    name: string;
    description?: string;
    stack?: string;
  },
) {
  const name = input.name?.trim();

  if (!name) throw new Error("Project name is required");

  const project = await prisma.project.create({
    data: {
      userId,
      name: name.slice(0, 120),
      description: input.description?.trim() || undefined,
      stack: input.stack?.trim() || undefined,
    },
  });

  try {
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: "OWNER",
      },
    });
  } catch (error) {
    // Roll back the project if owner membership creation fails.
    await prisma.project.delete({ where: { id: project.id } });
    throw error;
  }

  return project;
}

/**
 * Starts generation without waiting for OpenRouter to finish.
 * A Netlify Background Function performs the actual AI request.
 */
export async function startGenerateProject(
  id: string,
  userId: string,
  prompt: string,
  provider: Provider = "OPENROUTER",
) {
  const project = await owner(id, userId);
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) throw new Error("Prompt is required");
  if (cleanPrompt.length > 30000) {
    throw new Error("Prompt must be 30,000 characters or fewer");
  }

  if (project.status === "GENERATING") {
    throw new Error("Project generation is already running");
  }

  const secret = process.env.DEVFORGE_BACKGROUND_SECRET;
  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.APP_URL;

  if (!secret) {
    throw new Error("Background generation is not configured");
  }

  if (!baseUrl) {
    throw new Error("Netlify site URL is not configured");
  }

  // Create the run and mark the project as generating atomically.
  const run = await prisma.$transaction(async (tx) => {
    const currentProject = await tx.project.findUnique({
      where: { id },
    });

    if (!currentProject || currentProject.userId !== userId) {
      throw new Error("Project not found or access denied");
    }

    if (currentProject.status === "GENERATING") {
      throw new Error("Project generation is already running");
    }

    const newRun = await tx.projectRun.create({
      data: {
        projectId: id,
        operation: "GENERATE",
        status: "RUNNING",
        input: {
          prompt: cleanPrompt,
          provider,
        },
        startedAt: new Date(),
      },
    });

    await tx.project.update({
      where: { id },
      data: { status: "GENERATING" },
    });

    return newRun;
  });

  try {
    const response = await fetch(
      new URL(BACKGROUND_FUNCTION_PATH, baseUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-devforge-background-secret": secret,
        },
        body: JSON.stringify({
          runId: run.id,
          projectId: id,
          userId,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    // A Netlify Background Function should acknowledge accepted work
    // promptly with HTTP 202.
    if (response.status !== 202 && !response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Background function rejected the job (${response.status})${
          detail ? `: ${detail.slice(0, 500)}` : ""
        }`,
      );
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        status: "GENERATING",
      },
      run: {
        id: run.id,
        status: run.status,
        operation: run.operation,
        createdAt: run.createdAt,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to start project generation";

    await prisma.$transaction([
      prisma.projectRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          error: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id },
        data: { status: "FAILED" },
      }),
    ]);

    throw new Error(`Could not enqueue generation: ${message}`);
  }
}

/**
 * Called only by the background worker.
 * The worker owns all AI generation and artifact persistence.
 */
export async function processGenerateProject(
  runId: string,
  projectId: string,
  userId: string,
) {
  const run = await prisma.projectRun.findUnique({
    where: { id: runId },
  });

  if (
    !run ||
    run.projectId !== projectId ||
    run.operation !== "GENERATE"
  ) {
    throw new Error("Generation run not found");
  }

  if (run.status === "SUCCESS") {
    return { alreadyCompleted: true };
  }

  const input = run.input as {
    prompt?: string;
    provider?: Provider;
  } | null;

  const prompt = input?.prompt?.trim();
  const provider = input?.provider || "OPENROUTER";

  if (!prompt) throw new Error("The generation run has no prompt");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.userId !== userId) {
    throw new Error("Project not found or access denied");
  }

  const started = Date.now();

  try {
    const result = await generate(
      [
        {
          role: "system",
          content:
            SYSTEM +
            "\nReturn valid JSON with these keys: requirements, architecture, database, api, plan, files. " +
            "The files key must be an array. Each file should include its relative path and generated content.",
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

    const text = result.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let plan: {
      requirements?: unknown;
      architecture?: unknown;
      database?: unknown;
      api?: unknown;
      plan?: unknown;
      files?: unknown;
    };

    try {
      plan = JSON.parse(text);
    } catch {
      throw new Error(
        "The AI provider returned invalid JSON. Please retry generation.",
      );
    }

    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      throw new Error("The AI provider returned an invalid project structure");
    }

    const files = Array.isArray(plan.files) ? plan.files : [];

    await prisma.$transaction(async (tx) => {
      // Keep previous artifacts if the new generation fails before this
      // transaction. Replace the previous generated set on success.
      await tx.artifact.deleteMany({
        where: { projectId },
      });

      const artifactData = [
        {
          type: "REQUIREMENTS" as const,
          name: "requirements.json",
          content: plan.requirements ?? {},
        },
        {
          type: "ARCHITECTURE" as const,
          name: "architecture.json",
          content: plan.architecture ?? {},
        },
        {
          type: "DATABASE" as const,
          name: "database.json",
          content: plan.database ?? {},
        },
        {
          type: "API" as const,
          name: "api.json",
          content: plan.api ?? {},
        },
        {
          type: "PLAN" as const,
          name: "plan.json",
          content: plan.plan ?? [],
        },
        {
          type: "CODE" as const,
          name: "generated-files.json",
          content: files,
        },
      ];

      for (const artifact of artifactData) {
        await tx.artifact.create({
          data: {
            projectId,
            ...artifact,
          },
        });
      }

      await tx.projectRun.update({
        where: { id: runId },
        data: {
          status: "SUCCESS",
          output: {
            files: files.length,
            latencyMs: Date.now() - started,
            usage: result.usage ?? null,
          },
          error: null,
          finishedAt: new Date(),
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: "READY" },
      });
    });

    return {
      success: true,
      files: files.length,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";

    await prisma.$transaction([
      prisma.projectRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          error: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { status: "FAILED" },
      }),
    ]);

    throw error;
  }
}