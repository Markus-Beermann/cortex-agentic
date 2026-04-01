import "dotenv/config";

import { app } from "./app";
import { initSchema } from "./db";

const PORT = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  if (process.env.DATABASE_URL) {
    await initSchema();
    console.log("[server] schema ready");
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] startup failed", err);
  process.exit(1);
});
