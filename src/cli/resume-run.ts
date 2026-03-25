import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const runId = process.argv[2];

  if (!runId) {
    throw new Error("Usage: npm run resume -- <run-id>");
  }

  const rootPath = process.cwd();
  const { runner } = await createCliSessionRunner(rootPath);
  const run = await runner.runUntilStable(runId);

  console.log(
    JSON.stringify(
      {
        runId: run.id,
        status: run.status,
        pendingApprovalIds: run.pendingApprovalIds,
        completedTaskIds: run.completedTaskIds,
        outputIds: run.outputIds
      },
      null,
      2
    )
  );
}

void main();

