import dotenv from "dotenv";
dotenv.config({ override: true });
import path from "node:path";

import { OrchestrationLoop } from "../engine/orchestration-loop";
import type { ApprovalMode, RoleId } from "../core/contracts";
import type { CliProviderId } from "./runtime";
import { createCliSessionRunnerWithOptions } from "./runtime";

interface DryRunOptions {
  goal: string;
  projectId: string;
  providerId: CliProviderId;
  rootApprovalMode: ApprovalMode;
  handoffApprovalModeByRole: Partial<Record<RoleId, ApprovalMode>>;
}

function parseProvider(value: string): CliProviderId {
  if (value === "noop" || value === "anthropic") {
    return value;
  }

  throw new Error(`Unknown provider "${value}". Expected "noop" or "anthropic".`);
}

function parseArguments(argv: string[]): DryRunOptions {
  const goalParts: string[] = [];
  let providerId: CliProviderId = "noop";
  let projectId = "sandbox";
  let rootApprovalMode: ApprovalMode = "auto";
  const handoffApprovalModeByRole: Partial<Record<RoleId, ApprovalMode>> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument?.startsWith("--provider=")) {
      providerId = parseProvider(argument.replace("--provider=", ""));
      continue;
    }

    if (argument === "--provider") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --provider.");
      }

      providerId = parseProvider(nextValue);
      index += 1;
      continue;
    }

    if (argument?.startsWith("--project=")) {
      projectId = argument.replace("--project=", "");
      continue;
    }

    if (argument === "--project") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --project.");
      }

      projectId = nextValue;
      index += 1;
      continue;
    }

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
    goal: goalParts.join(" ") || "Bootstrap the reusable orchestration core for George.",
    projectId,
    providerId,
    rootApprovalMode,
    handoffApprovalModeByRole
  };
}

async function main(): Promise<void> {
  const rootPath = process.cwd();
  const options = parseArguments(process.argv.slice(2));

  const { runner } = await createCliSessionRunnerWithOptions(rootPath, {
    providerId: options.providerId,
    handoffApprovalModeByRole: options.handoffApprovalModeByRole
  });
  const loop = new OrchestrationLoop(runner);
  const run = await loop.runGoal(
    {
      projectId: options.projectId,
      goal: options.goal,
      approvalMode: options.rootApprovalMode
    },
    8
  );

  console.log(
    JSON.stringify(
      {
        runId: run.id,
        projectId: options.projectId,
        providerId: options.providerId,
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

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
