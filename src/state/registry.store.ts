import path from "node:path";

import type { RegistryEntry, RoleId } from "../core/contracts";
import { validateRegistryEntry } from "../core/contracts";
import { readJsonFile, readJsonFileIfExists, writeJsonFile } from "./file-store";

export class RegistryStore {
  private readonly filePath: string;

  public constructor(rootPath: string) {
    this.filePath = path.join(rootPath, ".orchestrator", "registry.json");
  }

  public async seed(entries: RegistryEntry[]): Promise<RegistryEntry[]> {
    const existing = await readJsonFileIfExists<RegistryEntry[]>(this.filePath);

    if (existing !== null) {
      return existing.map(validateRegistryEntry);
    }

    const validatedEntries = entries.map(validateRegistryEntry);
    await writeJsonFile(this.filePath, validatedEntries);
    return validatedEntries;
  }

  public async list(): Promise<RegistryEntry[]> {
    const entries = await readJsonFile<RegistryEntry[]>(this.filePath);
    return entries.map(validateRegistryEntry);
  }

  public async getByRole(roleId: RoleId): Promise<RegistryEntry | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.roleId === roleId) ?? null;
  }
}

