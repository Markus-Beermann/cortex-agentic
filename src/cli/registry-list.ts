import { createDefaultRegistry } from "../state/default-registry";
import { RegistryStore } from "../state/registry.store";

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());
  const entries = await registryStore.list();

  console.log(
    JSON.stringify(
      {
        agents: entries.map((entry) => ({
          roleId: entry.roleId,
          technicalName: entry.technicalName,
          personaName: entry.personaName,
          aliases: entry.aliases,
          bootstrapPath: entry.bootstrapPath,
          allowedHandoffs: entry.allowedHandoffs
        }))
      },
      null,
      2
    )
  );
}

void main();

