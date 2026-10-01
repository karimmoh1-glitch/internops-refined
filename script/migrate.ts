// Applies every migrations/*.sql file that hasn't been applied yet, in
// filename order, each inside its own transaction, recording it in
// schema_migrations. This is the ONLY sanctioned way to change the
// production schema — never `drizzle-kit push` (it mis-introspects the
// production database and tries to recreate existing objects).
//
//   npm run db:migrate            # uses DATABASE_URL
//   DATABASE_URL=... npm run db:migrate
import "dotenv/config";
import pg from "pg";
import { readdir, readFile } from "fs/promises";
import path from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const client = new pg.Client({ connectionString: url, ssl: /render\.com|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const dir = path.resolve(process.cwd(), "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf-8");
      console.log(`applying ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log(count === 0 ? "database is up to date" : `applied ${count} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
