import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
// Fail during startup rather than allowing requests to proceed without a database.
const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error("Database connection is not configured. Set DATABASE_URL in the project-root .env to your Supabase PostgreSQL connection string, then restart the local server.");
}
// Reuse the Prisma client during local hot reloads to avoid opening excess connections.
const adapter = new PrismaPg({ connectionString: url });
const g = globalThis;
export const prisma = g.prisma ?? new PrismaClient({ adapter });
// Production runtimes manage their own process lifecycle; cache only in development.
if (process.env.NODE_ENV !== "production")
    g.prisma = prisma;
