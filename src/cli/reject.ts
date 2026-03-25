import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const approvalId = process.argv[2];

  if (!approvalId) {
    throw new Error("Usage: npm run reject -- <approval-id>");
  }

  const rootPath = process.cwd();
  const { runner } = await createCliSessionRunner(rootPath);
  const run = await runner.rejectRequest(approvalId);

  console.log(
    JSON.stringify(
      {
        approvalId,
        runId: run.id,
        status: run.status,
        pendingApprovalIds: run.pendingApprovalIds
      },
      null,
      2
    )
  );
}

void main();

