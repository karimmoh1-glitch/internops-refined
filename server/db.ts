import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

// Every `timestamp` column is "without time zone" and drizzle reads those
// as UTC. Postgres' now() writes the SESSION time zone's wall clock, so a
// database whose default zone isn't UTC (local dev, some managed hosts)
// would store local time that is then read back as UTC. The session zone
// is pinned at connection time so defaults and explicit Date writes agree.
// Pool size stays small: on serverless hosts many instances share the
// database's connection limit.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  options: "-c timezone=UTC",
});

// An idle client dropped by the server (network blip, Postgres restart,
// managed-DB failover) emits 'error' on the pool. Without a listener that
// is an uncaught exception and the whole process dies.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
