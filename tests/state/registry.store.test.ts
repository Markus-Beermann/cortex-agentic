import { mkdtemp, rm } from "node:fs/promises";
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

    expect(personaEntry?.roleId).toBe("architect");
    expect(aliasEntry?.roleId).toBe("coordinator");
  });
});
