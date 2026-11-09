// One-off helper: list users and optionally promote the first user to ADMIN.
// Usage:
//   node scripts/set-admin.mjs            -> lists users
//   node scripts/set-admin.mjs <githubUsername|email> -> sets role = ADMIN for that user
//   ADMIN_GITHUB_USERNAME may be used instead of the username argument.
import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DIRECT_URL or DATABASE_URL in the project-root .env.");
}

const username =
  process.argv[2] ||
  process.env.ADMIN_GITHUB_USERNAME?.trim().replace(/^@/, "");
const client = new pg.Client({ connectionString });

await client.connect();
try {
  if (!username) {
    const { rows } = await client.query(
      'SELECT "githubId", "githubUsername", email, role, "isBlocked", "createdAt" FROM "User" ORDER BY "createdAt"',
    );
    console.table(rows);
  } else {
    const { rows } = await client.query(
      'UPDATE "User" SET role = \'ADMIN\' WHERE lower("githubUsername") = lower($1) OR lower(email) = lower($1) RETURNING id, "githubUsername", email, role',
      [username],
    );
    if (!rows.length) {
      throw new Error(`No user found with GitHub username "${username}".`);
    }
    console.log("Promoted to ADMIN:", rows[0]);
  }
} finally {
  await client.end();
}
