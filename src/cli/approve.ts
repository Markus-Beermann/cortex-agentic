import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const approvalId = process.argv[2];

  if (!approvalId) {
    throw new Error("Usage: npm run approve -- <approval-id>");
  }

  const rootPath = process.cwd();
  const { runner } = await createCliSessionRunner(rootPath);
  const run = await runner.approveRequest(approvalId, { resume: true });

  console.log(
    JSON.stringify(
      {
        approvalId,
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

