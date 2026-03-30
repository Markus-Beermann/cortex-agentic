import path from "node:path";

import type { Handoff } from "../core/contracts";
import { validateHandoff } from "../core/contracts";
import { listFilesIfExists, readJsonFile, writeJsonFile } from "./file-store";

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

  public async list(): Promise<Handoff[]> {
    const entries = await listFilesIfExists(this.directoryPath);
    const handoffs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => this.get(entry.replace(/\.json$/u, "")))
    );

    return handoffs.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async listByRun(runId: string): Promise<Handoff[]> {
    const handoffs = await this.list();
    return handoffs.filter((handoff) => handoff.runId === runId);
  }

  private filePath(handoffId: string): string {
    return path.join(this.directoryPath, `${handoffId}.json`);
  }
}
