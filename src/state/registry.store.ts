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
    const seededEntries = entries.map(validateRegistryEntry);
    const existing = await readJsonFileIfExists<RegistryEntry[]>(this.filePath);

    if (existing !== null) {
      try {
        const validatedExistingEntries = existing.map(validateRegistryEntry);
        const mergedEntries = this.mergeEntries(validatedExistingEntries, seededEntries);

        if (JSON.stringify(validatedExistingEntries) !== JSON.stringify(mergedEntries)) {
          await writeJsonFile(this.filePath, mergedEntries);
        }

        return mergedEntries;
      } catch {
        await writeJsonFile(this.filePath, seededEntries);
        return seededEntries;
      }
    }

    await writeJsonFile(this.filePath, seededEntries);
    return seededEntries;
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

  private mergeEntries(
    existingEntries: RegistryEntry[],
    seededEntries: RegistryEntry[]
  ): RegistryEntry[] {
    const seededEntriesByRole = new Map(seededEntries.map((entry) => [entry.roleId, entry]));
    const mergedEntries = existingEntries.map((entry) => {
      const seededEntry = seededEntriesByRole.get(entry.roleId);

      if (!seededEntry) {
        return entry;
      }

      return {
        ...seededEntry,
        aliases: this.unique([...entry.aliases, ...seededEntry.aliases]),
        capabilities: this.unique([...entry.capabilities, ...seededEntry.capabilities]),
        allowedHandoffs: this.unique([...entry.allowedHandoffs, ...seededEntry.allowedHandoffs])
      };
    });

    for (const seededEntry of seededEntries) {
      if (!mergedEntries.some((entry) => entry.roleId === seededEntry.roleId)) {
        mergedEntries.push(seededEntry);
      }
    }

    return mergedEntries;
  }

  private unique<T extends string>(values: T[]): T[] {
    return Array.from(new Set(values));
  }
}
