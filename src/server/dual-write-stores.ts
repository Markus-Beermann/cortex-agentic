import type { Pool } from "pg";

import type { RunEvent, RunState } from "../core/contracts";
import { EventLogStore } from "../state/event-log.store";
import { RunStateStore } from "../state/run-state.store";

export class DualWriteRunStateStore extends RunStateStore {
  public constructor(
    rootPath: string,
    private readonly pool: Pool
  ) {
    super(rootPath);
  }

  public override async save(runState: RunState): Promise<RunState> {
    const saved = await super.save(runState);
    await this.pool.query(
      `INSERT INTO runs (id, project_id, goal, status, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status     = EXCLUDED.status,
         data       = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [
        saved.id,
        saved.projectId,
        saved.goal,
        saved.status,
        JSON.stringify(saved),
        saved.createdAt,
        saved.updatedAt
      ]
    );
    return saved;
  }
}

export class DualWriteEventLogStore extends EventLogStore {
  public constructor(
    rootPath: string,
    private readonly pool: Pool
  ) {
    super(rootPath);
  }

  public override async append(
    runId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<RunEvent> {
    const event = await super.append(runId, eventType, payload);
    await this.pool.query(
      `INSERT INTO run_events (id, run_id, event_type, timestamp, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, event.runId, event.eventType, event.timestamp, JSON.stringify(event.payload)]
    );
    return event;
  }
}
