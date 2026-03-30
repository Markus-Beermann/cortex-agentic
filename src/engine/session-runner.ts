import { randomUUID } from "node:crypto";

import type { ProjectAdapterPort } from "../adapters/projects/project-adapter.port";
import type { ProviderPort } from "../adapters/providers/provider.port";
import type {
  ApprovalRequest,
  ApprovalMode,
  Output,
  ProviderResponse,
  RegistryEntry,
  RunState,
  Task
} from "../core/contracts";
import { validateOutput, validateProviderResponse } from "../core/contracts";
import type {
  ExecutionPolicy,
  PolicyDecision,
  PolicyDecisionStatus
} from "../core/policies/execution-policy";
import { routeOutputToHandoff, type RoutedHandoff } from "./handoff-router";
import { buildProviderRequest } from "./provider-request";
import { nowIso } from "../state/file-store";
import { EventLogStore } from "../state/event-log.store";
import { HandoffStore } from "../state/handoff.store";
import { OutputStore } from "../state/output.store";
import { RegistryStore } from "../state/registry.store";
import { RunStateStore } from "../state/run-state.store";
import { TaskStore } from "../state/task.store";
import { ApprovalRequestStore } from "../state/approval-request.store";

export interface SessionRunnerDependencies {
  provider: ProviderPort;
  projectAdapter: ProjectAdapterPort;
  policy: ExecutionPolicy;
  registryStore: RegistryStore;
  taskStore: TaskStore;
  outputStore: OutputStore;
  handoffStore: HandoffStore;
  approvalRequestStore: ApprovalRequestStore;
  runStateStore: RunStateStore;
  eventLogStore: EventLogStore;
  handoffApprovalModeByRole?: Partial<Record<Task["requestedRole"], ApprovalMode>>;
}

export interface InitializeRunInput {
  projectId: string;
  goal: string;
  approvalMode?: Task["approvalMode"];
}

export interface StepResult {
  run: RunState;
  output: Output | null;
  continued: boolean;
  policyDecision: PolicyDecision | null;
  approvalRequest: ApprovalRequest | null;
}

export class SessionRunner {
  public constructor(private readonly dependencies: SessionRunnerDependencies) {}

  public async initializeRun(input: InitializeRunInput): Promise<RunState> {
    const timestamp = nowIso();
    const runId = randomUUID();
    const rootTask = this.createRootTask({
      runId,
      projectId: input.projectId,
      goal: input.goal,
      approvalMode: input.approvalMode ?? "auto",
      createdAt: timestamp
    });

    const runState: RunState = {
      id: runId,
      projectId: input.projectId,
      goal: input.goal,
      status: "pending",
      activeTaskId: null,
      pendingApprovalIds: [],
      queuedTaskIds: [rootTask.id],
      completedTaskIds: [],
      outputIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.dependencies.taskStore.save(rootTask);
    await this.dependencies.runStateStore.save(runState);
    await this.dependencies.eventLogStore.append(runId, "run.initialized", {
      goal: input.goal,
      rootTaskId: rootTask.id
    });

    return runState;
  }

  public async runNextStep(runId: string): Promise<StepResult> {
    const run = await this.dependencies.runStateStore.get(runId);

    if (run.status === "waiting_approval" && run.pendingApprovalIds.length > 0) {
      return {
        run,
        output: null,
        continued: false,
        policyDecision: {
          status: "needs-approval",
          reason: "Run is waiting for a human approval decision."
        },
        approvalRequest: await this.dependencies.approvalRequestStore.get(
          run.pendingApprovalIds[0]
        )
      };
    }

    if (run.status === "failed") {
      return {
        run,
        output: null,
        continued: false,
        policyDecision: {
          status: "blocked",
          reason: "Run is already failed."
        },
        approvalRequest: null
      };
    }

    if (run.queuedTaskIds.length === 0) {
      const completedRun = await this.finalizeRunIfIdle(run);
      return {
        run: completedRun,
        output: null,
        continued: false,
        policyDecision: null,
        approvalRequest: null
      };
    }

    const [nextTaskId, ...remainingTaskIds] = run.queuedTaskIds;
    const task = await this.dependencies.taskStore.get(nextTaskId);
    const registryEntry = await this.loadRegistryEntry(task.requestedRole);
    const executionDecision = this.dependencies.policy.canExecute(task);

    if (executionDecision.status !== "allowed") {
      const approvalRequest =
        executionDecision.status === "needs-approval"
          ? await this.createApprovalRequestForTask(task, executionDecision.reason)
          : null;
      const pausedRun = await this.updateRunStatus(
        run,
        executionDecision.status,
        approvalRequest?.id ?? null
      );
      await this.dependencies.eventLogStore.append(run.id, "policy.execution_gate", {
        taskId: task.id,
        status: executionDecision.status,
        reason: executionDecision.reason
      });

      return {
        run: pausedRun,
        output: null,
        continued: false,
        policyDecision: executionDecision,
        approvalRequest
      };
    }

    const runningRun: RunState = {
      ...run,
      status: "running",
      activeTaskId: task.id,
      queuedTaskIds: remainingTaskIds,
      updatedAt: nowIso()
    };

    await this.dependencies.runStateStore.save(runningRun);
    await this.dependencies.eventLogStore.append(run.id, "task.started", {
      taskId: task.id,
      roleId: task.requestedRole
    });

    const projectContext = await this.dependencies.projectAdapter.loadContext(run.projectId);
    const completedTasks = await Promise.all(
      run.completedTaskIds.map((completedTaskId) =>
        this.dependencies.taskStore.get(completedTaskId)
      )
    );
    const completedOutputs = await this.dependencies.outputStore.getMany(run.outputIds);
    const providerRequest = buildProviderRequest({
      providerId: this.dependencies.provider.id,
      projectContext,
      role: registryEntry,
      run: runningRun,
      task,
      completedTasks,
      completedOutputs,
      handoffApprovalMode: this.resolveHandoffApprovalMode(task.requestedRole)
    });
    const providerResponse: ProviderResponse = validateProviderResponse(
      await this.dependencies.provider.execute(providerRequest)
    );
    const output = this.applyHandoffApprovalModeOverride(
      validateOutput(providerResponse.output),
      task.requestedRole
    );

    const completedTask: Task = {
      ...task,
      status: "completed",
      updatedAt: output.createdAt
    };

    await this.dependencies.taskStore.save(completedTask);
    await this.dependencies.outputStore.save(output);
    await this.dependencies.eventLogStore.append(run.id, "task.completed", {
      taskId: task.id,
      outputId: output.id
    });
    await this.dependencies.eventLogStore.append(run.id, "provider.executed", {
      providerId: providerResponse.providerId,
      adapterVersion: providerResponse.adapterVersion,
      model: providerResponse.model,
      requestId: providerRequest.id,
      taskId: task.id,
      roleId: task.requestedRole,
      contextPurpose: providerRequest.selectedContext.purpose,
      diagnostics: providerResponse.diagnostics
    });

    let nextRun: RunState = {
      ...runningRun,
      activeTaskId: null,
      completedTaskIds: [...runningRun.completedTaskIds, task.id],
      outputIds: [...runningRun.outputIds, output.id],
      updatedAt: output.createdAt
    };

    const routedHandoff = routeOutputToHandoff({
      output,
      currentTask: completedTask,
      currentRole: registryEntry,
      createdAt: output.createdAt
    });

    let handoffDecision: PolicyDecision | null = null;

    if (routedHandoff !== null) {
      handoffDecision = this.dependencies.policy.canHandoff(routedHandoff.handoff);
      await this.dependencies.handoffStore.save(routedHandoff.handoff);

      if (handoffDecision.status === "allowed") {
        await this.dependencies.taskStore.save(routedHandoff.nextTask);
        nextRun = {
          ...nextRun,
          queuedTaskIds: [...nextRun.queuedTaskIds, routedHandoff.nextTask.id]
        };

        await this.dependencies.eventLogStore.append(run.id, "handoff.created", {
          handoffId: routedHandoff.handoff.id,
          nextTaskId: routedHandoff.nextTask.id,
          toRole: routedHandoff.handoff.toRole
        });
      } else {
        let approvalRequest: ApprovalRequest | null = null;

        if (handoffDecision.status === "needs-approval") {
          await this.dependencies.taskStore.save(routedHandoff.nextTask);
          approvalRequest = await this.createApprovalRequestForHandoff(
            routedHandoff.handoff,
            routedHandoff.nextTask,
            handoffDecision.reason
          );
          nextRun = await this.updateRunStatus(
            nextRun,
            handoffDecision.status,
            approvalRequest.id
          );
        }

        await this.dependencies.eventLogStore.append(run.id, "policy.handoff_gate", {
          handoffId: routedHandoff.handoff.id,
          status: handoffDecision.status,
          reason: handoffDecision.reason
        });

        return {
          run: nextRun,
          output,
          continued: false,
          policyDecision: handoffDecision,
          approvalRequest
        };
      }
    }

    nextRun = await this.finalizeRunIfIdle(nextRun);

    return {
      run: nextRun,
      output,
      continued: nextRun.status === "running" && nextRun.queuedTaskIds.length > 0,
      policyDecision: handoffDecision,
      approvalRequest: null
    };
  }

  public async runUntilStable(runId: string, maxSteps = 8): Promise<RunState> {
    let currentRun = await this.dependencies.runStateStore.get(runId);

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      const stepResult = await this.runNextStep(currentRun.id);
      currentRun = stepResult.run;

      if (!stepResult.continued) {
        return currentRun;
      }
    }

    return currentRun;
  }

  public async approveRequest(
    approvalId: string,
    options: { resume?: boolean } = {}
  ): Promise<RunState> {
    const approvalRequest = await this.dependencies.approvalRequestStore.get(approvalId);

    if (approvalRequest.status !== "pending") {
      throw new Error(`Approval request ${approvalId} is already ${approvalRequest.status}.`);
    }

    const decidedAt = nowIso();
    const run = await this.dependencies.runStateStore.get(approvalRequest.runId);

    if (approvalRequest.subjectType === "task") {
      const task = await this.dependencies.taskStore.get(approvalRequest.subjectId);
      await this.dependencies.taskStore.save({
        ...task,
        approvalMode: "auto",
        updatedAt: decidedAt
      });
    } else {
      const handoff = await this.dependencies.handoffStore.get(approvalRequest.subjectId);
      await this.dependencies.handoffStore.save({
        ...handoff,
        approvalMode: "auto"
      });

      if (approvalRequest.proposedTaskId !== null) {
        const nextTask = await this.dependencies.taskStore.get(approvalRequest.proposedTaskId);
        await this.dependencies.taskStore.save({
          ...nextTask,
          approvalMode: "auto",
          updatedAt: decidedAt
        });
      }
    }

    await this.dependencies.approvalRequestStore.save({
      ...approvalRequest,
      status: "approved",
      decidedAt
    });

    const updatedRun = await this.dependencies.runStateStore.save({
      ...run,
      status: "pending",
      pendingApprovalIds: run.pendingApprovalIds.filter((id) => id !== approvalId),
      queuedTaskIds:
        approvalRequest.proposedTaskId !== null &&
        !run.queuedTaskIds.includes(approvalRequest.proposedTaskId)
          ? [...run.queuedTaskIds, approvalRequest.proposedTaskId]
          : run.queuedTaskIds,
      updatedAt: decidedAt
    });

    await this.dependencies.eventLogStore.append(run.id, "approval.approved", {
      approvalId,
      subjectType: approvalRequest.subjectType,
      subjectId: approvalRequest.subjectId
    });

    if (options.resume ?? true) {
      return this.runUntilStable(updatedRun.id);
    }

    return updatedRun;
  }

  public async rejectRequest(approvalId: string): Promise<RunState> {
    const approvalRequest = await this.dependencies.approvalRequestStore.get(approvalId);

    if (approvalRequest.status !== "pending") {
      throw new Error(`Approval request ${approvalId} is already ${approvalRequest.status}.`);
    }

    const decidedAt = nowIso();
    const run = await this.dependencies.runStateStore.get(approvalRequest.runId);

    await this.dependencies.approvalRequestStore.save({
      ...approvalRequest,
      status: "rejected",
      decidedAt
    });

    const failedRun = await this.dependencies.runStateStore.save({
      ...run,
      status: "failed",
      activeTaskId: null,
      pendingApprovalIds: run.pendingApprovalIds.filter((id) => id !== approvalId),
      updatedAt: decidedAt
    });

    await this.dependencies.eventLogStore.append(run.id, "approval.rejected", {
      approvalId,
      subjectType: approvalRequest.subjectType,
      subjectId: approvalRequest.subjectId
    });

    return failedRun;
  }

  private createRootTask(input: {
    runId: string;
    projectId: string;
    goal: string;
    approvalMode: Task["approvalMode"];
    createdAt: string;
  }): Task {
    return {
      id: randomUUID(),
      runId: input.runId,
      projectId: input.projectId,
      title: "Coordinate the incoming goal",
      objective: input.goal,
      requestedRole: "coordinator",
      constraints: [
        "Keep the orchestration core project-agnostic.",
        "Respect governance and bootstrap separation."
      ],
      inputContext: ["Goal received by George."],
      acceptanceCriteria: [
        "Classify the goal.",
        "Route the next role explicitly."
      ],
      status: "queued",
      approvalMode: input.approvalMode,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  }

  private async loadRegistryEntry(roleId: RegistryEntry["roleId"]): Promise<RegistryEntry> {
    const entry = await this.dependencies.registryStore.getByRole(roleId);

    if (entry === null) {
      throw new Error(`Missing registry entry for role ${roleId}.`);
    }

    return entry;
  }

  private async finalizeRunIfIdle(run: RunState): Promise<RunState> {
    if (run.queuedTaskIds.length > 0 || run.activeTaskId !== null) {
      await this.dependencies.runStateStore.save(run);
      return run;
    }

    if (run.status === "waiting_approval" || run.status === "failed") {
      await this.dependencies.runStateStore.save(run);
      return run;
    }

    const completedRun: RunState = {
      ...run,
      status: "completed",
      updatedAt: nowIso()
    };

    await this.dependencies.runStateStore.save(completedRun);
    await this.dependencies.eventLogStore.append(run.id, "run.completed", {
      completedTaskCount: completedRun.completedTaskIds.length
    });

    return completedRun;
  }

  private async updateRunStatus(
    run: RunState,
    status: Exclude<PolicyDecisionStatus, "allowed">,
    pendingApprovalId: string | null = null
  ): Promise<RunState> {
    const mappedStatus = status === "needs-approval" ? "waiting_approval" : "failed";
    const updatedRun: RunState = {
      ...run,
      status: mappedStatus,
      activeTaskId: null,
      pendingApprovalIds:
        pendingApprovalId === null
          ? run.pendingApprovalIds
          : [...run.pendingApprovalIds, pendingApprovalId],
      updatedAt: nowIso()
    };

    await this.dependencies.runStateStore.save(updatedRun);
    return updatedRun;
  }

  private async createApprovalRequestForTask(
    task: Task,
    reason: string
  ): Promise<ApprovalRequest> {
    const existingRequest = await this.dependencies.approvalRequestStore.findPendingBySubject(
      task.runId,
      task.id
    );

    if (existingRequest !== null) {
      return existingRequest;
    }

    const approvalRequest: ApprovalRequest = {
      id: randomUUID(),
      runId: task.runId,
      subjectType: "task",
      subjectId: task.id,
      requestedRole: task.requestedRole,
      proposedTaskId: null,
      summary: `Approval required before executing task "${task.title}".`,
      reason,
      status: "pending",
      createdAt: nowIso(),
      decidedAt: null
    };

    return this.dependencies.approvalRequestStore.save(approvalRequest);
  }

  private async createApprovalRequestForHandoff(
    handoff: RoutedHandoff["handoff"],
    nextTask: RoutedHandoff["nextTask"],
    reason: string
  ): Promise<ApprovalRequest> {
    const existingRequest = await this.dependencies.approvalRequestStore.findPendingBySubject(
      handoff.runId,
      handoff.id
    );

    if (existingRequest !== null) {
      return existingRequest;
    }

    const approvalRequest: ApprovalRequest = {
      id: randomUUID(),
      runId: handoff.runId,
      subjectType: "handoff",
      subjectId: handoff.id,
      requestedRole: handoff.toRole,
      proposedTaskId: nextTask.id,
      summary: `Approval required before handing off from ${handoff.fromRole} to ${handoff.toRole}.`,
      reason,
      status: "pending",
      createdAt: nowIso(),
      decidedAt: null
    };

    return this.dependencies.approvalRequestStore.save(approvalRequest);
  }

  private resolveHandoffApprovalMode(roleId: Task["requestedRole"]): ApprovalMode {
    return this.dependencies.handoffApprovalModeByRole?.[roleId] ?? "auto";
  }

  private applyHandoffApprovalModeOverride(
    output: Output,
    roleId: Task["requestedRole"]
  ): Output {
    if (output.nextAction.kind !== "handoff") {
      return output;
    }

    return {
      ...output,
      nextAction: {
        ...output.nextAction,
        approvalMode: this.resolveHandoffApprovalMode(roleId)
      }
    };
  }
}
