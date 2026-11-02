import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const configuredUrl = process.env.DATABASE_URL;

if (!configuredUrl) {
  console.error(
    "No DATABASE_URL configured. Copy .env.example to .env and set your local PostgreSQL password.",
  );
  process.exit(1);
}

let targetUrl;
try {
  targetUrl = new URL(configuredUrl);
} catch {
  console.error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  process.exit(1);
}

const databaseName = decodeURIComponent(targetUrl.pathname.replace(/^\/+/, ""));
if (
  !databaseName ||
  ["postgres", "template0", "template1"].includes(databaseName)
) {
  console.error(
    "DATABASE_URL must target an application database, such as devforge.",
  );
  process.exit(1);
}

const adminUrl = new URL(targetUrl);
adminUrl.pathname = "/postgres";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
});

try {
  const [database] = await prisma.$queryRaw`
    SELECT datname
    FROM pg_database
    WHERE datname = ${databaseName}
  `;

  if (database) {
    console.log(`Database "${databaseName}" already exists.`);
  } else {
    const quotedName = `"${databaseName.replaceAll('"', '""')}"`;
    await prisma.$executeRawUnsafe(`CREATE DATABASE ${quotedName}`);
    console.log(`Created database "${databaseName}".`);
  }
} catch (error) {
  const message =
    error instanceof Error ? error.message.split("\n")[0] : "Unknown error";
  console.error(`Could not create or inspect the local database: ${message}`);
  console.error(
    "Check the PostgreSQL service, DATABASE_URL credentials, and CREATEDB permission.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
