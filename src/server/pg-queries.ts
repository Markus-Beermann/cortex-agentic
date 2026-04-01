import type { Pool } from "pg";

import type { RunEvent, RunState } from "../core/contracts";
import { validateRunEvent, validateRunState } from "../core/contracts";

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
    timestamp: string;
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
      timestamp: row.timestamp,
      payload: row.payload as Record<string, unknown>
    })
  );
}
