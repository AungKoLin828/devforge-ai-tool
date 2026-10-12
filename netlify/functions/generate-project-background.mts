
import type { Config, Context } from "@netlify/functions";
import { processGenerateProject } from "../../src/server/projects.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const expectedSecret = process.env.DEVFORGE_BACKGROUND_SECRET;
  const suppliedSecret = req.headers.get(
    "x-devforge-background-secret",
  );

  if (
    !expectedSecret ||
    !suppliedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    runId?: string;
    projectId?: string;
    userId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { runId, projectId, userId } = body;

  if (!runId || !projectId || !userId) {
    return new Response("runId, projectId and userId are required", {
      status: 400,
    });
  }

  try {
    await processGenerateProject(runId, projectId, userId);

    return Response.json({ success: true });
  } catch (error) {
    // processGenerateProject records the failed run and project status.
    console.error("Background project generation failed", {
      runId,
      projectId,
      message:
        error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { success: false, message: "Generation failed" },
      { status: 500 },
    );
  }
};

export const config: Config = {
  path: "/.netlify/functions/generate-project-background",
};