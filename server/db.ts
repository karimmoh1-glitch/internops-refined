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
// Every `timestamp` column is "without time zone" and drizzle reads those
// as UTC. Postgres' now() writes the SESSION time zone's wall clock, so a
// database whose default zone isn't UTC (local dev, some managed hosts)
// would store local time that is then read back as UTC. Pin the session
// zone so defaults and explicit Date writes agree everywhere.
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'UTC'").catch((err) => console.error("[db] could not set session time zone:", err.message));
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
