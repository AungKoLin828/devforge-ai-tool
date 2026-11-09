import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prefer a direct/session connection for migrations; app requests use DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
