import path from "node:path";

import type { Task } from "../core/contracts";
import { validateTask } from "../core/contracts";
import { listFilesIfExists, readJsonFile, writeJsonFile } from "./file-store";

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

  public async list(): Promise<Task[]> {
    const entries = await listFilesIfExists(this.directoryPath);
    const tasks = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => this.get(entry.replace(/\.json$/u, "")))
    );

    return tasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async listByRun(runId: string): Promise<Task[]> {
    const tasks = await this.list();
    return tasks.filter((task) => task.runId === runId);
  }

  private filePath(taskId: string): string {
    return path.join(this.directoryPath, `${taskId}.json`);
  }
}
