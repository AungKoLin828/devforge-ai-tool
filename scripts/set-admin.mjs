// One-off helper: list users and optionally promote the first user to ADMIN.
// Usage:
//   node scripts/set-admin.mjs            -> lists users
//   node scripts/set-admin.mjs <githubUsername>   -> sets role = ADMIN for that user
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const username = process.argv[2];

if (!username) {
  const { rows } = await client.query(
    'SELECT "githubId", "githubUsername", email, role, "isBlocked", "createdAt" FROM "User" ORDER BY "createdAt"',
  );
  console.table(rows);
} else {
  const { rows } = await client.query(
    'UPDATE "User" SET role = \'ADMIN\' WHERE "githubUsername" = $1 RETURNING id, "githubUsername", email, role',
    [username],
  );
  if (!rows.length) {
    console.error(`No user found with githubUsername "${username}".`);
    await client.end();
    process.exit(1);
  }
  console.log("Promoted to ADMIN:", rows[0]);
}

await client.end();
