import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
if (!url) throw new Error("DATABASE_URL or NETLIFY_DB_URL is required");
const adapter = new PrismaPg({ connectionString: url });
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
