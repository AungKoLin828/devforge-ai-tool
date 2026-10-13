import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
if (!url) {
  throw new Error(
    "Database connection is not configured. Set DATABASE_URL in the project root .env to the PostgreSQL database containing the DevForge tables, then restart the local server.",
  );
}
const adapter = new PrismaPg({ connectionString: url });
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
