import { createCliSessionRunner } from "./runtime";
import { filterRuns, parseRunListArguments } from "./run-list.logic";

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const options = parseRunListArguments(process.argv.slice(2));
  const { runStateStore } = await createCliSessionRunner(rootPath);
  const runs = filterRuns(await runStateStore.list(), options);

  console.log(
    JSON.stringify(
      {
        filters: {
          status: options.status ?? null
        },
        count: runs.length,
        runs: runs.map((run) => ({
          id: run.id,
          projectId: run.projectId,
          status: run.status,
          goal: run.goal,
          activeTaskId: run.activeTaskId,
          pendingApprovalIds: run.pendingApprovalIds,
          queuedTaskCount: run.queuedTaskIds.length,
          completedTaskCount: run.completedTaskIds.length,
          outputCount: run.outputIds.length,
          updatedAt: run.updatedAt
        }))
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
