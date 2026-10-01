import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// An idle client dropped by the server (network blip, Postgres restart,
// managed-DB failover) emits 'error' on the pool. Without a listener that
// is an uncaught exception and the whole process dies.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
