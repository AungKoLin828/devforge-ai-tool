import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Use the same URL as the application so this diagnostic checks the real target.
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
    // Report the connected database and schema without printing connection secrets.
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
      // Confirm the table shape expected by the login flow and Prisma user model.
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
    // Adapter errors can wrap PostgreSQL details at different `cause` depths.
    // Traverse known nested fields without printing credentials or full URLs.
    let current = error;
    let code = "";
    let message = "";
    let adapterErrorName = "";
    const seen = new Set();
    const pending = [error];
    while (pending.length > 0) {
      current = pending.pop();
      if (!current || typeof current !== "object" || seen.has(current)) continue;
      seen.add(current);
      if (!code && typeof current.code === "string") code = current.code;
      if (!message && typeof current.message === "string") {
        message = current.message.split("\n")[0];
      }
      if (
        !adapterErrorName &&
        current.name === "DriverAdapterError" &&
        typeof current.message === "string"
      ) {
        adapterErrorName = current.message;
      }
      if (current.cause && typeof current.cause === "object") {
        pending.push(current.cause);
      }
      if (current.meta && typeof current.meta === "object") {
        pending.push(current.meta);
      }
      if (
        current.driverAdapterError &&
        typeof current.driverAdapterError === "object"
      ) {
        pending.push(current.driverAdapterError);
      }
    }

    // Distinguish rejected credentials from network failures to give useful next steps.
    if (/authenticationfailed/i.test(adapterErrorName)) {
      console.error(
        "PostgreSQL is reachable, but it rejected the DATABASE_URL credentials. Reset the password for the configured database role, then update DATABASE_URL with that exact password.",
      );
    } else {
      console.error(`Database check failed${code ? ` (${code})` : ""}${message ? `: ${message}` : "."}`);
    }
    if (
      // Only network-class failures benefit from the additional host/port hint.
      !/authenticationfailed/i.test(adapterErrorName) &&
      ["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "P1001"].includes(code)
    ) {
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
    // Close the pool on both success and failure so this one-shot check exits cleanly.
    await prisma.$disconnect();
  }
}
