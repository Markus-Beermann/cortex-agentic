import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../src/state/default-registry";
import { RegistryStore } from "../../src/state/registry.store";

const temporaryDirectories: string[] = [];

describe("RegistryStore", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("resolves entries by persona name and alias", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-registry-"));
    temporaryDirectories.push(rootPath);

    const registryStore = new RegistryStore(rootPath);
    await registryStore.seed(createDefaultRegistry());

    const personaEntry = await registryStore.resolve("Michael Angelo");
    const aliasEntry = await registryStore.resolve("George Senior");
    const hermesEntry = await registryStore.resolve("Hermes");

    expect(personaEntry?.roleId).toBe("architect");
    expect(aliasEntry?.roleId).toBe("coordinator");
    expect(hermesEntry?.roleId).toBe("hermes");
  });

  it("merges seeded role updates into an existing registry file", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-registry-"));
    temporaryDirectories.push(rootPath);

    await mkdir(path.join(rootPath, ".orchestrator"), { recursive: true });
    await writeFile(
      path.join(rootPath, ".orchestrator", "registry.json"),
      JSON.stringify([
        {
          id: "role/coordinator",
          roleId: "coordinator",
          technicalName: "Coordinator",
          personaName: "George",
          aliases: ["George Senior"],
          displayName: "George",
          bootstrapPath: "docs/agent-context/roles/coordinator.bootstrap.md",
          capabilities: ["run setup"],
          allowedHandoffs: ["architect"]
        }
      ], null, 2),
      "utf8"
    );

    const registryStore = new RegistryStore(rootPath);
    const seededEntries = await registryStore.seed(createDefaultRegistry());
    const coordinatorEntry = seededEntries.find((entry) => entry.roleId === "coordinator");
    const hermesEntry = seededEntries.find((entry) => entry.roleId === "hermes");

    expect(coordinatorEntry?.allowedHandoffs).toContain("architect");
    expect(coordinatorEntry?.allowedHandoffs).toContain("implementer");
    expect(coordinatorEntry?.allowedHandoffs).toContain("reviewer");
    expect(hermesEntry?.allowedHandoffs).toEqual([]);
  });
});
