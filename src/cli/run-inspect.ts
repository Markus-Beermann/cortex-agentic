import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const runId = process.argv[2];

  if (!runId) {
    throw new Error("Usage: npm run run:inspect -- <run-id>");
  }

  const rootPath = process.cwd();
  const runtime = await createCliSessionRunner(rootPath);
  const run = await runtime.runStateStore.get(runId);
  const tasks = await runtime.taskStore.listByRun(runId);
  const outputs = await runtime.outputStore.getMany(run.outputIds);
  const handoffs = await runtime.handoffStore.listByRun(runId);
  const approvals = await runtime.approvalRequestStore.listByRun(runId);
  const events = await runtime.eventLogStore.list(runId);

  console.log(
    JSON.stringify(
      {
        run,
        tasks,
        outputs,
        handoffs,
        approvals,
        eventCount: events.length
      },
      null,
      2
    )
  );
}

void main();

