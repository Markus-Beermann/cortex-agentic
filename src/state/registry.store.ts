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
      try {
        return existing.map(validateRegistryEntry);
      } catch {
        const validatedEntries = entries.map(validateRegistryEntry);
        await writeJsonFile(this.filePath, validatedEntries);
        return validatedEntries;
      }
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

  public async resolve(query: string): Promise<RegistryEntry | null> {
    const entries = await this.list();
    const normalizedQuery = this.normalize(query);

    return (
      entries.find((entry) => {
        const candidates = [
          entry.id,
          entry.roleId,
          entry.technicalName,
          entry.personaName,
          entry.displayName,
          ...entry.aliases
        ];

        return candidates.some((candidate) => this.normalize(candidate) === normalizedQuery);
      }) ?? null
    );
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
