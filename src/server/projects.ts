
import { prisma } from "./db.js";
import { generate, SYSTEM, type Provider } from "./ai.js";

const BACKGROUND_FUNCTION_PATH =
  "/.netlify/functions/generate-project-background";

export async function owner(id: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Forbidden");
  }

  return project;
}

export const list = (userId: string) =>
  prisma.project.findMany({
    where: { userId },
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

  if (!name) {
    throw new Error("Project name is required");
  }

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        userId,
        name: name.slice(0, 120),
        description: input.description?.trim() || undefined,
        stack: input.stack?.trim() || undefined,
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: createdProject.id,
        userId,
        role: "OWNER",
      },
    });

    return createdProject;
  });

  return project;
}

/**
 * Start generation without waiting for the AI provider.
 *
 * Creates a ProjectRun and invokes the Netlify Background Function.
 * The API can return immediately instead of waiting for OpenRouter.
 */
export async function startGenerateProject(
  id: string,
  userId: string,
  prompt: string,
  provider: Provider = "OPENROUTER",
) {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("Prompt is required");
  }

  if (cleanPrompt.length > 30000) {
    throw new Error("Prompt must be 30,000 characters or fewer");
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

  const run = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== userId) {
      throw new Error("Forbidden");
    }

    if (project.status === "GENERATING") {
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
        id,
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
 * Executes project generation inside the Background Function.
 * Persists generated artifacts and updates the run/project statuses.
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

  if (run.status !== "RUNNING") {
    throw new Error("Generation run is not active");
  }

  const input = run.input as {
    prompt?: string;
    provider?: Provider;
  } | null;

  const prompt = input?.prompt?.trim();
  const provider = input?.provider || "OPENROUTER";

  if (!prompt) {
    throw new Error("The generation run has no prompt");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Forbidden");
  }

  const started = Date.now();

  try {
    const result = await generate(
      [
        {
          role: "system",
          content:
            SYSTEM +
            "\nReturn valid JSON with the keys requirements, architecture, database, api, plan, and files. " +
            "The files property must be an array of generated files. " +
            "Each generated file should include its relative path and content.",
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

    const cleanedText = result.text
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
      plan = JSON.parse(cleanedText);
    } catch {
      throw new Error(
        "The AI provider returned invalid JSON. Please retry generation.",
      );
    }

    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      throw new Error(
        "The AI provider returned an invalid project structure",
      );
    }

    const files = Array.isArray(plan.files) ? plan.files : [];

    const artifacts = [
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

    await prisma.$transaction(async (tx) => {
      // Replace only the artifacts generated by this workflow.
      // Keep review, build, and test artifacts intact.
      await tx.artifact.deleteMany({
        where: {
          projectId,
          type: {
            in: [
              "REQUIREMENTS",
              "ARCHITECTURE",
              "DATABASE",
              "API",
              "PLAN",
              "CODE",
            ],
          },
        },
      });

      for (const artifact of artifacts) {
        await tx.artifact.create({
          data: {
            projectId,
            type: artifact.type,
            name: artifact.name,
            content: artifact.content as any,
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
      error instanceof Error
        ? error.message
        : "Generation failed";

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