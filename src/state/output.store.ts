import path from "node:path";

import type { Output } from "../core/contracts";
import { validateOutput } from "../core/contracts";
import { listFilesIfExists, readJsonFile, writeJsonFile } from "./file-store";

export class OutputStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "outputs");
  }

  public async save(output: Output): Promise<Output> {
    const validatedOutput = validateOutput(output);
    await writeJsonFile(this.filePath(validatedOutput.id), validatedOutput);
    return validatedOutput;
  }

  public async get(outputId: string): Promise<Output> {
    return validateOutput(await readJsonFile<Output>(this.filePath(outputId)));
  }

  public async list(): Promise<Output[]> {
    const entries = await listFilesIfExists(this.directoryPath);
    const outputs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => this.get(entry.replace(/\.json$/u, "")))
    );

    return outputs.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async getMany(outputIds: string[]): Promise<Output[]> {
    return Promise.all(outputIds.map((outputId) => this.get(outputId)));
  }

  private filePath(outputId: string): string {
    return path.join(this.directoryPath, `${outputId}.json`);
  }
}
