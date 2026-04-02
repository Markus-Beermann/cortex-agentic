/**
 * poll — watch Railway for pending runs and execute them locally.
 *
 * Usage:
 *   npm run poll                      # noop provider (dry run)
 *   npm run poll -- --provider=anthropic
 *
 * The command polls the State-Server (DATABASE_PUBLIC_URL) every 5 s for a run
 * with status="pending". When found, the placeholder row is consumed (deleted),
 * and OrchestrationLoop starts a fresh execution — which dual-writes the real
 * run back to PostgreSQL. The dashboard shows the live run instead of the stale
 * placeholder.
 */

import "dotenv/config";

import path from "node:path";

import { OrchestrationLoop } from "../engine/orchestration-loop";
import { createCliSessionRunnerWithOptions, type CliProviderId } from "./runtime";
import { getPool } from "../server/db";

function parseProvider(argv: string[]): CliProviderId {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--provider=")) {
      const val = arg.replace("--provider=", "");
      if (val === "noop" || val === "anthropic") return val;
      throw new Error(`Unknown provider "${val}". Expected "noop" or "anthropic".`);
    }
    if (arg === "--provider") {
      const val = argv[i + 1];
      if (val === "noop" || val === "anthropic") return val;
      throw new Error(`Unknown provider "${String(val)}". Expected "noop" or "anthropic".`);
    }
  }
  return "noop";
}

interface PendingRunRow {
  id: string;
  goal: string;
  project_id: string;
}

/**
 * Atomically claims the oldest pending run by deleting the placeholder row.
 * Returns the claimed run's metadata, or null if there are no pending runs.
 */
async function claimNextPendingRun(
  pool: ReturnType<typeof getPool>
): Promise<PendingRunRow | null> {
  const result = await pool.query<PendingRunRow>(
    `DELETE FROM runs
     WHERE id = (
       SELECT id FROM runs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, goal, project_id`
  );
  return result.rows[0] ?? null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const providerId = parseProvider(args);
  const rootPath = process.cwd();

  if (!process.env.DATABASE_PUBLIC_URL) {
    console.error("DATABASE_PUBLIC_URL is not set — poll requires a PostgreSQL connection.");
    process.exit(1);
  }

  const pool = getPool();
  console.log(`[poll] Watching for pending runs (provider=${providerId}) — Ctrl+C to stop\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let claimed: PendingRunRow | null = null;

    try {
      claimed = await claimNextPendingRun(pool);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[poll] DB error while polling: ${msg}`);
      await sleep(5_000);
      continue;
    }

    if (!claimed) {
      process.stdout.write(".");
      await sleep(5_000);
      continue;
    }

    const { id: placeholderId, goal, project_id: projectId } = claimed;
    console.log(`\n[poll] Claimed pending run ${placeholderId} — goal: "${goal}"`);
    console.log(`[poll] Starting execution (projectId=${projectId}, provider=${providerId})…`);

    try {
      const { runner } = await createCliSessionRunnerWithOptions(rootPath, { providerId });
      const loop = new OrchestrationLoop(runner);

      const finalRun = await loop.runGoal(
        {
          projectId: projectId ?? "sandbox",
          goal
        },
        8
      );

      console.log(`[poll] Run ${finalRun.id} → status=${finalRun.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll] Execution failed for goal "${goal}": ${msg}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
