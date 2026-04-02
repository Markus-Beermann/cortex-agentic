import { randomUUID } from "node:crypto";

import type {
  CompletedWorkItem,
  ExecutionProfile,
  Output,
  ProviderRequest,
  RegistryEntry,
  RunState,
  Task
} from "../core/contracts";
import { validateProviderRequest } from "../core/contracts";
import { nowIso } from "../state/file-store";
import { selectContextForRole } from "./context-selection";

function buildCompletedWork(
  completedTasks: Task[],
  completedOutputs: Output[]
): CompletedWorkItem[] {
  const outputsByTaskId = new Map(completedOutputs.map((output) => [output.taskId, output]));

  return completedTasks.map((completedTask) => {
    const output = outputsByTaskId.get(completedTask.id);

    return {
      taskId: completedTask.id,
      roleId: completedTask.requestedRole,
      title: completedTask.title,
      objective: completedTask.objective,
      outputSummary: output?.summary ?? "No output summary was persisted.",
      nextActionKind: output?.nextAction.kind ?? "complete"
    };
  });
}

export function buildProviderRequest(input: {
  providerId: string;
  projectContext: ProviderRequest["projectContext"];
  role: RegistryEntry;
  run: RunState;
  task: Task;
  completedTasks: Task[];
  completedOutputs: Output[];
  handoffApprovalMode: Task["approvalMode"];
  executionProfile: ExecutionProfile;
}): ProviderRequest {
  const {
    providerId,
    projectContext,
    role,
    run,
    task,
    completedTasks,
    completedOutputs,
    handoffApprovalMode,
    executionProfile
  } = input;

  return validateProviderRequest({
    id: randomUUID(),
    providerId,
    runId: task.runId,
    taskId: task.id,
    roleId: role.roleId,
    technicalName: role.technicalName,
    personaName: role.personaName,
    displayName: role.displayName,
    bootstrapPath: role.bootstrapPath,
    capabilities: role.capabilities,
    allowedHandoffs: role.allowedHandoffs,
    projectContext,
    selectedContext: selectContextForRole(role.roleId, projectContext),
    executionProfile,
    handoffApprovalMode,
    runProgress: {
      status: run.status,
      activeTaskId: run.activeTaskId,
      pendingApprovalIds: run.pendingApprovalIds,
      queuedTaskIds: run.queuedTaskIds,
      completedTaskIds: run.completedTaskIds,
      outputIds: run.outputIds,
      completedWork: buildCompletedWork(completedTasks, completedOutputs)
    },
    task,
    createdAt: nowIso()
  });
}
