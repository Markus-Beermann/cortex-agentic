import path from "node:path";

import type { Task } from "../core/contracts";
import { validateTask } from "../core/contracts";
import { readJsonFile, writeJsonFile } from "./file-store";

export class TaskStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "tasks");
  }

  public async save(task: Task): Promise<Task> {
    const validatedTask = validateTask(task);
    await writeJsonFile(this.filePath(validatedTask.id), validatedTask);
    return validatedTask;
  }

  public async get(taskId: string): Promise<Task> {
    return validateTask(await readJsonFile<Task>(this.filePath(taskId)));
  }

  private filePath(taskId: string): string {
    return path.join(this.directoryPath, `${taskId}.json`);
  }
}

