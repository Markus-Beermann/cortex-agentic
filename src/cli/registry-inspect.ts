import { createDefaultRegistry } from "../state/default-registry";
import { RegistryStore } from "../state/registry.store";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();

  if (!query) {
    throw new Error("Usage: npm run registry:inspect -- <role-id|technical-name|persona-name|alias>");
  }

  const rootPath = process.cwd();
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const entry = await registryStore.resolve(query);

  if (entry === null) {
    throw new Error(`No registry entry found for "${query}".`);
  }

  console.log(
    JSON.stringify(
      {
        id: entry.id,
        roleId: entry.roleId,
        technicalName: entry.technicalName,
        personaName: entry.personaName,
        aliases: entry.aliases,
        displayName: entry.displayName,
        bootstrapPath: entry.bootstrapPath,
        capabilities: entry.capabilities,
        allowedHandoffs: entry.allowedHandoffs
      },
      null,
      2
    )
  );
}

void main();

