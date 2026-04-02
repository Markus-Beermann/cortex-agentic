import "dotenv/config";

import { getPool } from "../server/db";
import { createHermesRuntime } from "../hermes/runtime";

async function main(): Promise<void> {
  if (!process.env.DATABASE_PUBLIC_URL) {
    throw new Error("DATABASE_PUBLIC_URL is required for Hermes nightly mail.");
  }

  const result = await createHermesRuntime(getPool()).createNightlyMailer().run();
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
