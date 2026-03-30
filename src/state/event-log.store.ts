import { randomUUID } from "node:crypto";
import path from "node:path";

import type { RunEvent } from "../core/contracts";
import { validateRunEvent } from "../core/contracts";
import { appendJsonLine, nowIso, readJsonLinesFileIfExists } from "./file-store";

export class EventLogStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "events");
  }

  public async append(
    runId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<RunEvent> {
    const event = validateRunEvent({
      id: randomUUID(),
      runId,
      eventType,
      timestamp: nowIso(),
      payload
    });

    await appendJsonLine(this.filePath(runId), event);
    return event;
  }

  public async list(runId: string): Promise<RunEvent[]> {
    const events = await readJsonLinesFileIfExists<RunEvent>(this.filePath(runId));
    return events.map(validateRunEvent);
  }

  private filePath(runId: string): string {
    return path.join(this.directoryPath, `${runId}.jsonl`);
  }
}
