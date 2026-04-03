import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_PUBLIC_URL;
    if (!connectionString) {
      throw new Error("DATABASE_PUBLIC_URL environment variable is not set");
    }
    _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
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

    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      run_id     TEXT NOT NULL,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS tasks_run_id_idx ON tasks (run_id);

    CREATE TABLE IF NOT EXISTS outputs (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS outputs_task_id_idx ON outputs (task_id);

    CREATE TABLE IF NOT EXISTS feed_items (
      id           TEXT PRIMARY KEY,
      source       TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      content_json JSONB NOT NULL,
      processed_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL,
      tags         TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS feed_items_source_idx ON feed_items (source);
    CREATE INDEX IF NOT EXISTS feed_items_created_at_idx ON feed_items (created_at DESC);
    CREATE INDEX IF NOT EXISTS feed_items_source_event_idx ON feed_items (source, event_type);

    CREATE TABLE IF NOT EXISTS deferred_tasks (
      id           TEXT PRIMARY KEY,
      addressee    TEXT NOT NULL,
      goal         TEXT NOT NULL,
      context      JSONB,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL,
      released_at  TIMESTAMPTZ,
      created_by   TEXT NOT NULL DEFAULT 'markus'
    );

    CREATE INDEX IF NOT EXISTS deferred_tasks_status_idx ON deferred_tasks (status);
    CREATE INDEX IF NOT EXISTS deferred_tasks_addressee_idx ON deferred_tasks (addressee);

    CREATE TABLE IF NOT EXISTS architecture_snapshots (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      mermaid      TEXT NOT NULL,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL
    );
  `);
}
