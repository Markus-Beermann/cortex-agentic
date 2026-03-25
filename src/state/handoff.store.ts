import path from "node:path";

import type { Handoff } from "../core/contracts";
import { validateHandoff } from "../core/contracts";
import { readJsonFile, writeJsonFile } from "./file-store";

export class HandoffStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "handoffs");
  }

  public async save(handoff: Handoff): Promise<Handoff> {
    const validatedHandoff = validateHandoff(handoff);
    await writeJsonFile(this.filePath(validatedHandoff.id), validatedHandoff);
    return validatedHandoff;
  }

  public async get(handoffId: string): Promise<Handoff> {
    return validateHandoff(await readJsonFile<Handoff>(this.filePath(handoffId)));
  }

  private filePath(handoffId: string): string {
    return path.join(this.directoryPath, `${handoffId}.json`);
  }
}

