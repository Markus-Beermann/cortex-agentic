import { createHash, randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type {
  ArchitectureSnapshot,
  DeferredTask,
  DeferredTaskStatus,
  Output,
  RunEvent,
  RunState,
  Task
} from "../core/contracts";
import {
  validateArchitectureSnapshot,
  validateDeferredTask,
  validateOutput,
  validateRunEvent,
  validateRunState,
  validateTask
} from "../core/contracts";
import type { FeedItem } from "../hermes/contracts";
import { validateFeedItem } from "../hermes/contracts";

function normalizeEventTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Unsupported run event timestamp value: ${String(value)}`);
}

export async function pgListRuns(pool: Pool): Promise<RunState[]> {
  const result = await pool.query<{ data: unknown }>(
    `SELECT data FROM runs ORDER BY updated_at DESC`
  );
  return result.rows.map((row) => validateRunState(row.data));
}

export async function pgGetRunState(pool: Pool, runId: string): Promise<RunState | null> {
  const result = await pool.query<{ data: unknown }>(
    `SELECT data FROM runs WHERE id = $1`,
    [runId]
  );
  if (result.rows.length === 0) return null;
  return validateRunState(result.rows[0].data);
}

export async function pgListEvents(pool: Pool, runId: string): Promise<RunEvent[]> {
  const result = await pool.query<{
    id: string;
    run_id: string;
    event_type: string;
    timestamp: string | Date;
    payload: unknown;
  }>(
    `SELECT id, run_id, event_type, timestamp, payload
     FROM run_events
     WHERE run_id = $1
     ORDER BY timestamp ASC`,
    [runId]
  );
  return result.rows.map((row) =>
    validateRunEvent({
      id: row.id,
      runId: row.run_id,
      eventType: row.event_type,
      timestamp: normalizeEventTimestamp(row.timestamp),
      payload: row.payload as Record<string, unknown>
    })
  );
}

export async function pgListTasks(pool: Pool, runId: string): Promise<Task[]> {
  const result = await pool.query<{ data: unknown }>(
    `SELECT data FROM tasks WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId]
  );
  return result.rows.map((row) => validateTask(row.data));
}

export async function pgListOutputs(pool: Pool, runId: string): Promise<Output[]> {
  const result = await pool.query<{ data: unknown }>(
    `SELECT o.data FROM outputs o
     JOIN tasks t ON t.id = o.task_id
     WHERE t.run_id = $1
     ORDER BY o.created_at ASC`,
    [runId]
  );
  return result.rows.map((row) => validateOutput(row.data));
}

export async function pgListFeedItems(pool: Pool, limit = 50): Promise<FeedItem[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
  const result = await pool.query<{
    id: string;
    source: FeedItem["source"];
    event_type: string;
    content_json: unknown;
    created_at: string | Date;
    processed_at: string | Date | null;
    tags: string[];
  }>(
    `SELECT id, source, event_type, content_json, created_at, processed_at, tags
     FROM feed_items
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );

  return result.rows.map((row) =>
    validateFeedItem({
      id: row.id,
      source: row.source,
      eventType: row.event_type,
      contentJson: row.content_json as Record<string, unknown>,
      createdAt: normalizeEventTimestamp(row.created_at),
      processedAt:
        row.processed_at === null ? null : normalizeEventTimestamp(row.processed_at),
      tags: row.tags
    })
  );
}

export async function pgSaveDeferredTask(
  pool: Pool,
  input: {
    id?: string;
    addressee: string;
    goal: string;
    context?: Record<string, unknown> | null;
    createdBy?: string;
  }
): Promise<DeferredTask> {
  const id = input.id ?? randomUUID();
  const createdAt = new Date().toISOString();
  const result = await pool.query<{
    id: string;
    addressee: string;
    goal: string;
    context: Record<string, unknown> | null;
    status: string;
    created_at: string | Date;
    released_at: string | Date | null;
    created_by: string;
  }>(
    `INSERT INTO deferred_tasks (id, addressee, goal, context, status, created_at, released_at, created_by)
     VALUES ($1, $2, $3, $4::jsonb, 'pending', $5, NULL, $6)
     RETURNING id, addressee, goal, context, status, created_at, released_at, created_by`,
    [
      id,
      input.addressee,
      input.goal,
      JSON.stringify(input.context ?? null),
      createdAt,
      input.createdBy ?? "markus"
    ]
  );

  return mapDeferredTaskRow(result.rows[0]);
}

export async function pgListDeferredTasks(
  pool: Pool,
  filters: {
    addressee?: string;
    status?: DeferredTaskStatus;
  } = {}
): Promise<DeferredTask[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.addressee) {
    values.push(filters.addressee);
    clauses.push(`addressee = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query<{
    id: string;
    addressee: string;
    goal: string;
    context: Record<string, unknown> | null;
    status: string;
    created_at: string | Date;
    released_at: string | Date | null;
    created_by: string;
  }>(
    `SELECT id, addressee, goal, context, status, created_at, released_at, created_by
     FROM deferred_tasks
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows.map(mapDeferredTaskRow);
}

export async function pgReleaseDeferredTask(
  pool: Pool,
  id: string
): Promise<DeferredTask | null> {
  const releasedAt = new Date().toISOString();
  const result = await pool.query<{
    id: string;
    addressee: string;
    goal: string;
    context: Record<string, unknown> | null;
    status: string;
    created_at: string | Date;
    released_at: string | Date | null;
    created_by: string;
  }>(
    `UPDATE deferred_tasks
     SET status = 'released',
         released_at = $2
     WHERE id = $1
     RETURNING id, addressee, goal, context, status, created_at, released_at, created_by`,
    [id, releasedAt]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapDeferredTaskRow(result.rows[0]);
}

export async function pgSaveArchitectureSnapshot(
  pool: Pool,
  input: {
    id?: string;
    title: string;
    mermaid: string;
    notes?: string | null;
  }
): Promise<ArchitectureSnapshot> {
  const id =
    input.id ??
    `snapshot_${createHash("sha256").update(`${input.title}\n${input.mermaid}`).digest("hex").slice(0, 24)}`;
  const createdAt = new Date().toISOString();
  const result = await pool.query<{
    id: string;
    title: string;
    mermaid: string;
    notes: string | null;
    created_at: string | Date;
  }>(
    `INSERT INTO architecture_snapshots (id, title, mermaid, notes, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           mermaid = EXCLUDED.mermaid,
           notes = EXCLUDED.notes
     RETURNING id, title, mermaid, notes, created_at`,
    [id, input.title, input.mermaid, input.notes ?? null, createdAt]
  );

  return mapArchitectureSnapshotRow(result.rows[0]);
}

export async function pgListArchitectureSnapshots(pool: Pool): Promise<ArchitectureSnapshot[]> {
  const result = await pool.query<{
    id: string;
    title: string;
    mermaid: string;
    notes: string | null;
    created_at: string | Date;
  }>(
    `SELECT id, title, mermaid, notes, created_at
     FROM architecture_snapshots
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapArchitectureSnapshotRow);
}

export async function pgCancelRun(pool: Pool, runId: string): Promise<RunState | null> {
  const result = await pool.query<{ data: unknown }>(
    `UPDATE runs
     SET status     = 'failed',
         data       = jsonb_set(data, '{status}', '"failed"'),
         updated_at = NOW()
     WHERE id = $1 AND status NOT IN ('completed', 'failed')
     RETURNING data`,
    [runId]
  );
  if (result.rows.length === 0) return null;
  return validateRunState(result.rows[0].data);
}

export async function pgCreatePendingRun(
  pool: Pool,
  goal: string,
  projectId: string
): Promise<RunState> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const run: RunState = {
    id,
    projectId,
    goal,
    status: "pending",
    activeTaskId: null,
    pendingApprovalIds: [],
    queuedTaskIds: [],
    completedTaskIds: [],
    outputIds: [],
    createdAt: now,
    updatedAt: now
  };
  await pool.query(
    `INSERT INTO runs (id, project_id, goal, status, data, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', $4::jsonb, $5, $6)`,
    [id, projectId, goal, JSON.stringify(run), now, now]
  );
  return run;
}

function mapDeferredTaskRow(row: {
  id: string;
  addressee: string;
  goal: string;
  context: Record<string, unknown> | null;
  status: string;
  created_at: string | Date;
  released_at: string | Date | null;
  created_by: string;
}): DeferredTask {
  return validateDeferredTask({
    id: row.id,
    addressee: row.addressee,
    goal: row.goal,
    context: row.context ?? null,
    status: row.status,
    createdAt: normalizeEventTimestamp(row.created_at),
    releasedAt:
      row.released_at === null ? null : normalizeEventTimestamp(row.released_at),
    createdBy: row.created_by
  });
}

function mapArchitectureSnapshotRow(row: {
  id: string;
  title: string;
  mermaid: string;
  notes: string | null;
  created_at: string | Date;
}): ArchitectureSnapshot {
  return validateArchitectureSnapshot({
    id: row.id,
    title: row.title,
    mermaid: row.mermaid,
    notes: row.notes,
    createdAt: normalizeEventTimestamp(row.created_at)
  });
}

export { normalizeEventTimestamp };
