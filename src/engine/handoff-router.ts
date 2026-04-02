import { randomUUID } from "node:crypto";

import type { Handoff, Output, RegistryEntry, RoleId, Task } from "../core/contracts";

export interface RoutedHandoff {
  handoff: Handoff;
  nextTask: Task;
}

export function routeOutputToHandoff(params: {
  output: Output;
  currentTask: Task;
  currentRole: RegistryEntry & { roleId: RoleId };
  createdAt: string;
}): RoutedHandoff | null {
  const { output, currentTask, currentRole, createdAt } = params;

  if (output.nextAction.kind === "complete") {
    return null;
  }

  if (!currentRole.allowedHandoffs.includes(output.nextAction.targetRole)) {
    throw new Error(
      `Role ${currentRole.roleId} cannot hand off to ${output.nextAction.targetRole}.`
    );
  }

  const handoff: Handoff = {
    id: randomUUID(),
    runId: currentTask.runId,
    taskId: currentTask.id,
    fromRole: currentRole.roleId,
    toRole: output.nextAction.targetRole,
    rationale: output.nextAction.rationale,
    briefing:
      output.nextAction.context.length > 0
        ? output.nextAction.context
        : [output.summary],
    approvalMode: output.nextAction.approvalMode,
    createdAt
  };

  const nextTask: Task = {
    id: randomUUID(),
    runId: currentTask.runId,
    projectId: currentTask.projectId,
    title: output.nextAction.taskTitle,
    objective: output.nextAction.taskObjective,
    requestedRole: output.nextAction.targetRole,
    constraints: currentTask.constraints,
    inputContext: [
      ...currentTask.inputContext,
      ...output.nextAction.context,
      `Handoff rationale: ${output.nextAction.rationale}`
    ],
    acceptanceCriteria: output.nextAction.acceptanceCriteria,
    status: "queued",
    approvalMode: output.nextAction.approvalMode,
    createdAt,
    updatedAt: createdAt
  };

  return { handoff, nextTask };
}
