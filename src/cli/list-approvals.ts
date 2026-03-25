import { createCliSessionRunner } from "./runtime";

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const { approvalRequestStore } = await createCliSessionRunner(rootPath);
  const requests = await approvalRequestStore.listPending();

  console.log(
    JSON.stringify(
      {
        pendingApprovals: requests.map((request) => ({
          id: request.id,
          runId: request.runId,
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          requestedRole: request.requestedRole,
          proposedTaskId: request.proposedTaskId,
          summary: request.summary,
          reason: request.reason,
          createdAt: request.createdAt
        }))
      },
      null,
      2
    )
  );
}

void main();

