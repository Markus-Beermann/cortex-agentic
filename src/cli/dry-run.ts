import path from "node:path";

import { OrchestrationLoop } from "../engine/orchestration-loop";
import type { ApprovalMode, RoleId } from "../core/contracts";
import { createCliSessionRunnerWithOptions } from "./runtime";

interface DryRunOptions {
  goal: string;
  rootApprovalMode: ApprovalMode;
  handoffApprovalModeByRole: Partial<Record<RoleId, ApprovalMode>>;
}

function parseArguments(argv: string[]): DryRunOptions {
  const goalParts: string[] = [];
  let rootApprovalMode: ApprovalMode = "auto";
  const handoffApprovalModeByRole: Partial<Record<RoleId, ApprovalMode>> = {};

  for (const argument of argv) {
    if (argument === "--root-approval") {
      rootApprovalMode = "needs-approval";
      continue;
    }

    if (argument.startsWith("--handoff-approval=")) {
      const roleId = argument.replace("--handoff-approval=", "") as RoleId;
      handoffApprovalModeByRole[roleId] = "needs-approval";
      continue;
    }

    goalParts.push(argument);
  }

  return {
    goal:
      goalParts.join(" ") || "Bootstrap the reusable orchestration core for George.",
    rootApprovalMode,
    handoffApprovalModeByRole
  };
}

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const options = parseArguments(process.argv.slice(2));

  const { runner } = await createCliSessionRunnerWithOptions(rootPath, {
    providerOptions: {
      handoffApprovalModeByRole: options.handoffApprovalModeByRole
    }
  });
  const loop = new OrchestrationLoop(runner);
  const run = await loop.runGoal(
    {
      projectId: path.basename(rootPath),
      goal: options.goal,
      approvalMode: options.rootApprovalMode
    },
    8
  );

  console.log(
    JSON.stringify(
      {
        runId: run.id,
        status: run.status,
        pendingApprovalIds: run.pendingApprovalIds,
        completedTaskIds: run.completedTaskIds,
        outputIds: run.outputIds,
        runtimePath: path.join(rootPath, ".orchestrator")
      },
      null,
      2
    )
  );
}

void main();
