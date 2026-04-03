import "dotenv/config";

import path from "node:path";

import { app } from "./app";
import { getPool, initSchema } from "./db";
import { seedDebussyArchitectureSnapshot } from "./seed-architecture-snapshot";

const PORT = Number(process.env.PORT ?? 3000);
const ROOT_PATH = process.env.ORCHESTRATOR_ROOT ?? process.cwd();

async function main(): Promise<void> {
  if (process.env.DATABASE_PUBLIC_URL) {
    await initSchema();
    await seedDebussyArchitectureSnapshot(getPool(), path.resolve(ROOT_PATH));
    console.log("[server] backend: postgres");
  } else {
    console.log("[server] backend: filesystem (DATABASE_PUBLIC_URL not set)");
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] startup failed", err);
  process.exit(1);
});
