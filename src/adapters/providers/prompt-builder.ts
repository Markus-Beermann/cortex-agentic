import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ProviderRequest } from "../../core/contracts";

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

function formatList(items: string[], fallback = "None."): string {
  if (items.length === 0) {
    return fallback;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatCompletedWork(request: ProviderRequest): string {
  if (request.runProgress.completedWork.length === 0) {
    return "No tasks have been completed yet in this run.";
  }

  return request.runProgress.completedWork
    .map(
      (item) =>
        `- ${item.roleId}: ${item.title} | objective: ${item.objective} | summary: ${item.outputSummary} | next action: ${item.nextActionKind}`
    )
    .join("\n");
}

function buildCoordinatorRoutingDirective(request: ProviderRequest): string[] {
  if (request.roleId !== "coordinator") {
    return [];
  }

  return [
    "COORDINATOR ROUTING DIRECTIVE",
    "You are responsible for choosing the narrowest safe role path for this run.",
    `The preferred routing strategy for this task is "${request.executionProfile.routingStrategy}".`,
    `The preferred review mode for this task is "${request.executionProfile.reviewMode}".`,
    "Do not hand off to extra roles just because they exist.",
    "If you deviate from the execution profile, explain why in decisions and rationale."
  ];
}

function buildSystemPrompt(bootstrapContent: string, request: ProviderRequest): string {
  const selectedContext = request.selectedContext;

  return [
    `You are ${request.displayName}, the ${request.technicalName} role for George.`,
    "Follow the role bootstrap below as stable operating context.",
    "",
    "ROLE BOOTSTRAP",
    bootstrapContent.trim(),
    "",
    "CURRENT TASK",
    `Objective: ${request.task.objective}`,
    "Constraints:",
    formatList(request.task.constraints),
    "Acceptance criteria:",
    formatList(request.task.acceptanceCriteria),
    "Existing task context:",
    formatList(request.task.inputContext),
    "",
    "SELECTED PROJECT CONTEXT",
    `Purpose: ${selectedContext.purpose}`,
    `Summary: ${selectedContext.summary}`,
    "Focus paths:",
    formatList(selectedContext.focusPaths),
    "Relevant documents:",
    formatList(selectedContext.relevantDocuments),
    "Context notes:",
    formatList(selectedContext.notes),
    "",
    "EXECUTION PROFILE",
    `Work type: ${request.executionProfile.workType}`,
    `Complexity: ${request.executionProfile.complexity}`,
    `Routing strategy: ${request.executionProfile.routingStrategy}`,
    `Review mode: ${request.executionProfile.reviewMode}`,
    "Rationale:",
    formatList(request.executionProfile.rationale),
    "",
    "RUN PROGRESS",
    `Run status: ${request.runProgress.status}`,
    `Active task id: ${request.runProgress.activeTaskId ?? "none"}`,
    `Pending approvals: ${request.runProgress.pendingApprovalIds.length}`,
    `Queued task count: ${request.runProgress.queuedTaskIds.length}`,
    `Completed task count: ${request.runProgress.completedTaskIds.length}`,
    "Completed work:",
    formatCompletedWork(request),
    "",
    "HANDOFF RULES",
    `Allowed handoffs for this role: ${request.allowedHandoffs.join(", ") || "none"}.`,
    `If you hand off, use approvalMode "${request.handoffApprovalMode}".`,
    "Skip unnecessary roles when the task is already bounded and low-risk.",
    "",
    ...buildCoordinatorRoutingDirective(request),
    ...(request.roleId === "coordinator" ? [""] : []),
    "OUTPUT RULES",
    "Return only valid JSON with exactly these top-level fields:",
    '- "summary": string',
    '- "decisions": string[]',
    '- "blockers": string[]',
    '- "artifacts": Array<{ "kind": "note" | "file" | "decision", "content": string, "path"?: string, "note"?: string }>',
    '- "nextAction": { "kind": "complete" } OR { "kind": "handoff", "targetRole": roleId, "taskTitle": string, "taskObjective": string, "acceptanceCriteria": string[], "context": string[], "rationale": string, "approvalMode": "auto" | "needs-approval" | "blocked" }',
    "File artifacts are materialized relative to the selected project root.",
    'When you return a file artifact, "path" must be project-relative and "content" must be the full file contents.',
    "Do not include markdown fences.",
    "Do not include id, taskId, roleId, or createdAt; the adapter will add them.",
    "Do not fabricate file changes, tests, or verification.",
    "If work cannot progress, put the reason in blockers and still return valid JSON."
  ].join("\n");
}

function buildUserPrompt(request: ProviderRequest): string {
  return [
    `Produce the next output contract draft for task "${request.task.title}".`,
    `The target role is ${request.roleId}.`,
    "Call the submit_output_contract tool exactly once with the final structured result.",
    "Do not answer with plain text when the tool can be used."
  ].join("\n");
}

export class PromptBuilder {
  public constructor(private readonly repositoryRootPath: string) {}

  public async build(request: ProviderRequest): Promise<BuiltPrompt> {
    const bootstrapPath = path.resolve(this.repositoryRootPath, request.bootstrapPath);
    const bootstrapContent = await readFile(bootstrapPath, "utf8");

    return {
      systemPrompt: buildSystemPrompt(bootstrapContent, request),
      userPrompt: buildUserPrompt(request)
    };
  }
}
