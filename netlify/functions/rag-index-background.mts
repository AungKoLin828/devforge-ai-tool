import type { Context } from "@netlify/functions";
import { processRagIndexJob } from "../../src/server/rag.js";

type BackgroundPayload = {
  runId?: unknown;
  projectId?: unknown;
  userId?: unknown;
};

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
  if (
    typeof runId !== "string" ||
    typeof projectId !== "string" ||
    typeof userId !== "string"
  ) {
    return new Response("runId, projectId and userId are required", {
      status: 400,
    });
  }

  try {
    await processRagIndexJob(runId, projectId, userId);
    return Response.json({ success: true });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Knowledge indexing failed.";
    console.error("Background knowledge indexing failed", {
      runId,
      projectId,
      message,
    });
    return Response.json(
      { success: false, message: "Knowledge indexing failed." },
      { status: 500 },
    );
  }
};
