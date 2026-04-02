import "dotenv/config";

import { getPool } from "../server/db";
import { createHermesRuntime } from "../hermes/runtime";
import { getHermesConfig } from "../hermes/config";

async function main(): Promise<void> {
  if (!process.env.DATABASE_PUBLIC_URL) {
    throw new Error("DATABASE_PUBLIC_URL is required for Hermes GitHub polling.");
  }

  const config = getHermesConfig();
  const pool = getPool();
  const { githubPoller } = createHermesRuntime(pool);
  const sinceIso = hoursAgoIso(config.githubLookbackHours);
  const result = await githubPoller.poll(sinceIso);

  console.log(
    JSON.stringify(
      {
        since: sinceIso,
        repositories: result.repositories,
        processed: result.processed,
        inserted: result.inserted
      },
      null,
      2
    )
  );
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
