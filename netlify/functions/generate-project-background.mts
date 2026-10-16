import type { Context } from "@netlify/functions";
import { prisma } from "../../src/server/db.js";
import { processGenerateProject } from "../../src/server/projects.js";

// Identifiers passed by the trusted enqueue route, not accepted from the browser.
type BackgroundPayload = {
  runId?: string;
  projectId?: string;
  userId?: string;
};

// Execute queued generation/modification work only when the shared secret matches.
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const expectedSecret = process.env.DEVFORGE_BACKGROUND_SECRET;
  const suppliedSecret = req.headers.get("x-devforge-background-secret");

  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: BackgroundPayload;

  try {
    payload = (await req.json()) as BackgroundPayload;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { runId, projectId, userId } = payload;

  if (!runId || !projectId || !userId) {
    return new Response("runId, projectId and userId are required", {
      status: 400,
    });
  }

  try {
    await processGenerateProject(runId, projectId, userId);
    return Response.json({ success: true });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Generation failed";

    console.error("Background project generation failed", {
      runId,
      projectId,
      message,
    });

    // Repair run/project state for failures that occur before the processor's
    // own catch block; updateMany tolerates records already changed or removed.
    await prisma.projectRun
      .updateMany({
        where: {
          id: runId,
          projectId,
          status: "RUNNING",
        },
        data: {
          status: "FAILED",
          error: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      })
      .catch((dbError) => {
        console.error("Could not mark generation run as failed", dbError);
      });

    await prisma.project
      .updateMany({
        where: {
          id: projectId,
          userId,
          status: "GENERATING",
        },
        data: { status: "FAILED" },
      })
      .catch((dbError) => {
        console.error("Could not mark project as failed", dbError);
      });

    return Response.json(
      { success: false, message: "Project generation failed" },
      { status: 500 },
    );
  }
};
