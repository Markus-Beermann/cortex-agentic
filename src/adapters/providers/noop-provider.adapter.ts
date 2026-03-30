import { randomUUID } from "node:crypto";

import type { ApprovalMode, Output, RoleId, Task } from "../../core/contracts";
import type { ProviderExecutionContext, ProviderPort } from "./provider.port";

export interface NoopProviderOptions {
  handoffApprovalModeByRole?: Partial<Record<RoleId, ApprovalMode>>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class NoopProviderAdapter implements ProviderPort {
  public readonly id = "noop";

  public constructor(private readonly options: NoopProviderOptions = {}) {}

  public async execute(context: ProviderExecutionContext): Promise<Output> {
    const timestamp = nowIso();
    const task = context.task;
    const personaName = context.role.personaName;
    const projectContext = context.projectContext;
    const stackSummary = projectContext.stack.languages.join(", ") || "unknown stack";
    const focusSummary =
      projectContext.focusPaths.length > 0
        ? projectContext.focusPaths.slice(0, 3).join(", ")
        : "no focused paths";

    switch (task.requestedRole) {
      case "coordinator":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "coordinator",
          summary: `${personaName} classified the goal "${task.objective}" and routed planning work.`,
          decisions: [
            "Start with explicit contracts.",
            `Route detailed planning to the architect role for a project using ${stackSummary}.`
          ],
          blockers: [],
          artifacts: [],
          nextAction: this.createHandoff(
            "architect",
            "Design the execution plan",
            `Decompose the goal into executable work packages for project ${task.projectId}.`,
            [
              "Define the first implementation slice.",
              "Keep the core project-agnostic."
            ],
            [
              `Original goal: ${task.objective}`,
              "Governance and operational bootstraps must remain separate."
            ],
            "Architect must turn the goal into execution-ready work.",
            this.resolveHandoffApprovalMode("coordinator")
          ),
          createdAt: timestamp
        };
      case "architect":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "architect",
          summary: `${personaName} translated the goal into a first implementation slice.`,
          decisions: [
            "Build contracts first.",
            `Use the structured project context from ${projectContext.rootPath}.`,
            `Prioritize focus paths: ${focusSummary}.`
          ],
          blockers: [],
          artifacts: [
            {
              kind: "decision",
              content: "Execution slice: contracts, state stores, orchestration loop, dry-run CLI."
            }
          ],
          nextAction: this.createHandoff(
            "implementer",
            "Implement the first orchestration slice",
            "Create the minimum executable core for George.",
            [
              "Persist runtime state to disk.",
              "Support a deterministic dry-run flow."
            ],
            [
              "Required artifacts: contracts, state stores, orchestration loop, CLI.",
              "Do not add provider-specific logic to the core."
            ],
            "Implementation can now proceed on bounded scope.",
            this.resolveHandoffApprovalMode("architect")
          ),
          createdAt: timestamp
        };
      case "implementer":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "implementer",
          summary: `${personaName} completed the bounded execution slice.`,
          decisions: [
            "File-backed state is sufficient for Phase 1.",
            `Project documents available: ${projectContext.documents.length}.`,
            `Repository dirty state: ${projectContext.repository.isDirty}.`
          ],
          blockers: [],
          artifacts: [
            {
              kind: "note",
              content: `Implemented deterministic execution path for "${task.title}".`
            }
          ],
          nextAction: this.createHandoff(
            "reviewer",
            "Review the implementation slice",
            "Validate the first orchestration slice against its contracts and acceptance criteria.",
            [
              "Confirm the output contract is satisfied.",
              "Identify remaining risks explicitly."
            ],
            [
              "Review scope: contracts, state stores, orchestration loop, CLI.",
              "Do not widen scope during review."
            ],
            "Review is required before closing the run.",
            this.resolveHandoffApprovalMode("implementer")
          ),
          createdAt: timestamp
        };
      case "reviewer":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "reviewer",
          summary: `${personaName} accepted the implementation slice and closed the run.`,
          decisions: [
            "Core contracts are explicit.",
            "The first deterministic loop is suitable for further extension."
          ],
          blockers: [],
          artifacts: [
            {
              kind: "decision",
              content: "Run completed without additional approval gates."
            }
          ],
          nextAction: {
            kind: "complete"
          },
          createdAt: timestamp
        };
    }
  }

  private createHandoff(
    targetRole: Task["requestedRole"],
    taskTitle: string,
    taskObjective: string,
    acceptanceCriteria: string[],
    context: string[],
    rationale: string,
    approvalMode: ApprovalMode
  ): Output["nextAction"] {
    return {
      kind: "handoff",
      targetRole,
      taskTitle,
      taskObjective,
      acceptanceCriteria,
      context,
      rationale,
      approvalMode
    };
  }

  private resolveHandoffApprovalMode(roleId: RoleId): ApprovalMode {
    return this.options.handoffApprovalModeByRole?.[roleId] ?? "auto";
  }
}
