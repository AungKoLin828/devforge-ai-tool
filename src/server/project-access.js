import { prisma } from "./db.js";
/** Return a project only when it belongs to the requesting user. */
export async function owner(id, userId) {
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
