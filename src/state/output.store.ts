import path from "node:path";

import type { Output } from "../core/contracts";
import { validateOutput } from "../core/contracts";
import { readJsonFile, writeJsonFile } from "./file-store";

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

  private filePath(outputId: string): string {
    return path.join(this.directoryPath, `${outputId}.json`);
  }
}

