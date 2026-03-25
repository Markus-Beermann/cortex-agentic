import path from "node:path";

import type { RunState } from "../core/contracts";
import { validateRunState } from "../core/contracts";
import { readJsonFile, writeJsonFile } from "./file-store";

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

  private filePath(runId: string): string {
    return path.join(this.directoryPath, `${runId}.json`);
  }
}

