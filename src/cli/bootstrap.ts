import path from "node:path";

import { createDefaultRegistry } from "../state/default-registry";
import { RegistryStore } from "../state/registry.store";

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const registryStore = new RegistryStore(rootPath);
  const entries = await registryStore.seed(createDefaultRegistry());

  console.log(
    JSON.stringify(
      {
        runtimePath: path.join(rootPath, ".orchestrator"),
        seededRoles: entries.map((entry) => entry.roleId)
      },
      null,
      2
    )
  );
}

void main();

