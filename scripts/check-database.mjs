import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "No database URL configured. Set DATABASE_URL in the project-root .env to your Supabase PostgreSQL connection string.",
  );
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const [target] = await prisma.$queryRaw`
      SELECT
        current_database() AS database,
        current_schema() AS schema,
        current_setting('search_path') AS search_path,
        to_regclass('public."User"')::text AS user_table
    `;

    console.log(`Connected database: ${target.database}`);
    console.log(`Current schema: ${target.schema}`);
    console.log(`Search path: ${target.search_path}`);
    console.log(`public."User": ${target.user_table ?? "MISSING"}`);

    if (!target.user_table) {
      console.error(
        'The app connection cannot see public."User". Run the schema SQL against this exact database, or update DATABASE_URL to the database where you already created the tables.',
      );
      process.exitCode = 1;
    } else {
      const columns = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
      `;
      const actualColumns = new Set(columns.map(({ column_name }) => column_name));
      const requiredColumns = [
        "id",
        "githubId",
        "githubUsername",
        "githubName",
        "email",
        "avatarUrl",
        "githubAccessTokenEnc",
        "createdAt",
        "updatedAt",
      ];
      const missingColumns = requiredColumns.filter(
        (column) => !actualColumns.has(column),
      );

      if (missingColumns.length > 0) {
        console.error(`Missing User columns: ${missingColumns.join(", ")}`);
        process.exitCode = 1;
      } else {
        console.log("User table columns match the Prisma User model.");
      }
    }
  } catch (error) {
    let current = error;
    let code = "";
    let message = "";
    const seen = new Set();
    while (current && typeof current === "object" && !seen.has(current)) {
      seen.add(current);
      if (!code && typeof current.code === "string") code = current.code;
      if (!message && typeof current.message === "string") {
        message = current.message.split("\n")[0];
      }
      current = current.cause;
    }

    console.error(`Database check failed${code ? ` (${code})` : ""}${message ? `: ${message}` : "."}`);
    if (["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "P1001"].includes(code)) {
      try {
        const database = new URL(connectionString);
        console.error(
          `Could not reach ${database.hostname}:${database.port || "5432"}. Check outbound TCP access on this port and allowlist/firewall settings. Supabase's session and transaction poolers commonly use ports 5432 and 6543, respectively.`,
        );
      } catch {
        console.error(
          "Check outbound TCP access to the Supabase PostgreSQL host and port configured in DATABASE_URL.",
        );
      }
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
