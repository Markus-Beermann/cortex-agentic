import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { Output, RunEvent, RunState, Task } from "../core/contracts";
import { validateOutput, validateRunEvent, validateRunState, validateTask } from "../core/contracts";

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

export { normalizeEventTimestamp };
