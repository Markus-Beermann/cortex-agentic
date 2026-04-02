import { randomUUID } from "node:crypto";

import type {
  CompletedWorkItem,
  ExecutionProfile,
  Output,
  ProjectContext,
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

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function buildExecutionProfile(task: Task, projectContext: ProjectContext): ExecutionProfile {
  const normalizedGoal = task.objective.toLowerCase();
  const contentKeywords = [
    "article",
    "artikel",
    "blog",
    "post",
    "essay",
    "summary",
    "documentation",
    "document",
    "write",
    "schreibe"
  ];
  const codeKeywords = [
    "api",
    "service",
    "microservice",
    "refactor",
    "migrate",
    "bug",
    "fix",
    "debug",
    "port",
    "engine",
    "typescript",
    "javascript",
    "python",
    "database"
  ];
  const analysisKeywords = [
    "review",
    "analyze",
    "analyse",
    "audit",
    "plan",
    "architecture",
    "architektur"
  ];

  if (containsAny(normalizedGoal, contentKeywords) && !containsAny(normalizedGoal, codeKeywords)) {
    return {
      workType: "content",
      complexity: "simple",
      routingStrategy: "direct-implementer",
      reviewMode: "skip-review",
      rationale: [
        "The goal reads like a bounded content deliverable.",
        "The result can be inspected directly as a file artifact."
      ]
    };
  }

  if (containsAny(normalizedGoal, analysisKeywords) && !containsAny(normalizedGoal, codeKeywords)) {
    return {
      workType: "analysis",
      complexity: "standard",
      routingStrategy: "plan-then-implement",
      reviewMode: "review-required",
      rationale: [
        "The goal emphasizes planning, review, or analysis work.",
        "The run should preserve a separate validation step."
      ]
    };
  }

  if (containsAny(normalizedGoal, codeKeywords)) {
    const isComplex =
      containsAny(normalizedGoal, ["microservice", "migrate", "migration", "database", "port"]) ||
      projectContext.repository.changedFiles.length > 8;

    return {
      workType: "code",
      complexity: isComplex ? "complex" : "standard",
      routingStrategy: isComplex ? "full-pipeline" : "plan-then-implement",
      reviewMode: "review-required",
      rationale: [
        "The goal references engineering or implementation-heavy work.",
        isComplex
          ? "The change surface suggests a full coordinator -> architect -> implementer -> reviewer path."
          : "Architecture planning is useful before implementation."
      ]
    };
  }

  return {
    workType: "unknown",
    complexity: "standard",
    routingStrategy: "plan-then-implement",
    reviewMode: "review-required",
    rationale: [
      "The goal does not match a safer direct-execution heuristic.",
      "Defaulting to planning preserves bounded scope."
    ]
  };
}

export function buildProviderRequest(input: {
  providerId: string;
  projectContext: ProjectContext;
  role: RegistryEntry;
  run: RunState;
  task: Task;
  completedTasks: Task[];
  completedOutputs: Output[];
  handoffApprovalMode: Task["approvalMode"];
}): ProviderRequest {
  const {
    providerId,
    projectContext,
    role,
    run,
    task,
    completedTasks,
    completedOutputs,
    handoffApprovalMode
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
    executionProfile: buildExecutionProfile(task, projectContext),
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
