import { prisma } from "../../src/server/db.js";
import { processReviewProject } from "../../src/server/projects.js";
export default async (req, _context) => {
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
    let payload;
    try {
        payload = (await req.json());
    }
    catch {
        return new Response("Invalid JSON body", { status: 400 });
    }
    const { runId, projectId, userId } = payload;
    if (!runId || !projectId || !userId) {
        return new Response("runId, projectId and userId are required", {
            status: 400,
        });
    }
    try {
        await processReviewProject(runId, projectId, userId);
        return Response.json({ success: true });
    }
    catch (caught) {
        const message = caught instanceof Error ? caught.message : "Project review failed";
        console.error("Background project review failed", {
            runId,
            projectId,
            message,
        });
        await prisma.projectRun
            .updateMany({
            where: { id: runId, projectId, status: "RUNNING" },
            data: {
                status: "FAILED",
                error: message.slice(0, 2000),
                finishedAt: new Date(),
            },
        })
            .catch((dbError) => {
            console.error("Could not mark review run as failed", dbError);
        });
        await prisma.project
            .updateMany({
            where: { id: projectId, userId, status: "REVIEWING" },
            data: { status: "FAILED" },
        })
            .catch((dbError) => {
            console.error("Could not mark project review as failed", dbError);
        });
        return Response.json({ success: false, message: "Project review failed" }, { status: 500 });
    }
};
