import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const { runStateStore } = await createCliSessionRunner(rootPath);
  const runs = await runStateStore.list();

  console.log(
    JSON.stringify(
      {
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

void main();

