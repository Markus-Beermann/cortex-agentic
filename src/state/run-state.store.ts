import path from "node:path";

import type { RunState } from "../core/contracts";
import { validateRunState } from "../core/contracts";
import { listFilesIfExists, readJsonFile, writeJsonFile } from "./file-store";

export class RunStateStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "runs");
  }

  public async save(runState: RunState): Promise<RunState> {
    const validatedRunState = validateRunState(runState);
    await writeJsonFile(this.filePath(validatedRunState.id), validatedRunState);
    return validatedRunState;
  }

  public async get(runId: string): Promise<RunState> {
    return validateRunState(await readJsonFile<RunState>(this.filePath(runId)));
  }

  public async list(): Promise<RunState[]> {
    const entries = await listFilesIfExists(this.directoryPath);
    const runs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => this.get(entry.replace(/\.json$/u, "")))
    );

    return runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private filePath(runId: string): string {
    return path.join(this.directoryPath, `${runId}.json`);
  }
}
