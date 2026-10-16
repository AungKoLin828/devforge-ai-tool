import "dotenv/config";
import { defineConfig } from "prisma/config";
// Keep Prisma CLI schema/migration locations aligned with the app's DATABASE_URL.
export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env.DATABASE_URL || "",
    },
});
