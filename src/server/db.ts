import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

export async function initSchema(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      goal        TEXT NOT NULL,
      status      TEXT NOT NULL,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_events (
      id          TEXT PRIMARY KEY,
      run_id      TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL,
      payload     JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS run_events_run_id_idx ON run_events (run_id);
  `);
}
