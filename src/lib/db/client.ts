import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Opens the database and applies migrations.
 *
 * - DATABASE_URL set: a real Postgres server (production, e.g. Neon or Supabase).
 * - DATABASE_URL unset: an embedded Postgres (PGlite) stored in .data/pglite,
 *   so local development needs no database server.
 * - DATABASE_URL="memory://": an in-memory PGlite, used by tests.
 */
export async function openDb(url = process.env.DATABASE_URL): Promise<{ db: Db; close: () => Promise<void> }> {
  if (url && !url.startsWith("memory://") && !url.startsWith("file://")) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return { db, close: () => pool.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = url?.startsWith("memory://")
    ? undefined
    : url?.startsWith("file://")
      ? url.slice("file://".length)
      : path.join(process.cwd(), ".data", "pglite");
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}

let shared: Promise<Db> | undefined;

/** Process-wide database handle for the web app. */
export function getDb(): Promise<Db> {
  shared ??= openDb().then((h) => h.db);
  return shared;
}
