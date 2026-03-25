import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FilesystemProjectAdapter } from "../../src/adapters/projects/filesystem-project.adapter";
import {
  NoopProviderAdapter,
  type NoopProviderOptions
} from "../../src/adapters/providers/noop-provider.adapter";
import { DefaultExecutionPolicy } from "../../src/core/policies/execution-policy";
import { SessionRunner } from "../../src/engine/session-runner";
import { createDefaultRegistry } from "../../src/state/default-registry";
import { ApprovalRequestStore } from "../../src/state/approval-request.store";
import { EventLogStore } from "../../src/state/event-log.store";
import { HandoffStore } from "../../src/state/handoff.store";
import { OutputStore } from "../../src/state/output.store";
import { RegistryStore } from "../../src/state/registry.store";
import { RunStateStore } from "../../src/state/run-state.store";
import { TaskStore } from "../../src/state/task.store";

const temporaryDirectories: string[] = [];

async function createRunner(
  rootPath: string,
  options: {
    providerOptions?: NoopProviderOptions;
  } = {}
): Promise<{
  runner: SessionRunner;
  approvalRequestStore: ApprovalRequestStore;
}> {
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const approvalRequestStore = new ApprovalRequestStore(rootPath);

  return {
    approvalRequestStore,
    runner: new SessionRunner({
      provider: new NoopProviderAdapter(options.providerOptions),
      projectAdapter: new FilesystemProjectAdapter(rootPath),
      policy: new DefaultExecutionPolicy(),
      registryStore,
      taskStore: new TaskStore(rootPath),
      outputStore: new OutputStore(rootPath),
      handoffStore: new HandoffStore(rootPath),
      approvalRequestStore,
      runStateStore: new RunStateStore(rootPath),
      eventLogStore: new EventLogStore(rootPath)
    })
  };
}

describe("SessionRunner", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("completes the deterministic dry-run flow", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
    temporaryDirectories.push(rootPath);

    const { runner } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "demo-project",
      goal: "Build the first orchestration slice."
    });

    const completedRun = await runner.runUntilStable(run.id, 8);

    expect(completedRun.status).toBe("completed");
    expect(completedRun.completedTaskIds).toHaveLength(4);
    expect(completedRun.outputIds).toHaveLength(4);
  });

  it("stops at the approval gate when the root task requires approval", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
    temporaryDirectories.push(rootPath);

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "demo-project",
      goal: "Pause for approval before any execution.",
      approvalMode: "needs-approval"
    });

    const pausedRun = await runner.runUntilStable(run.id, 8);

    expect(pausedRun.status).toBe("waiting_approval");
    expect(pausedRun.completedTaskIds).toHaveLength(0);
    expect(pausedRun.outputIds).toHaveLength(0);
    expect(pausedRun.pendingApprovalIds).toHaveLength(1);

    const approvals = await approvalRequestStore.listPending();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.subjectType).toBe("task");
  });

  it("approves a blocked root task and resumes the run", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
    temporaryDirectories.push(rootPath);

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "demo-project",
      goal: "Pause for approval before any execution.",
      approvalMode: "needs-approval"
    });

    await runner.runUntilStable(run.id, 8);
    const approvals = await approvalRequestStore.listPending();
    const approval = approvals[0];

    if (!approval) {
      throw new Error("Expected a pending approval request.");
    }

    const completedRun = await runner.approveRequest(approval.id);

    expect(completedRun.status).toBe("completed");
    expect(completedRun.pendingApprovalIds).toHaveLength(0);
    expect(completedRun.completedTaskIds).toHaveLength(4);
  });

  it("rejects a pending approval and fails the run", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
    temporaryDirectories.push(rootPath);

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "demo-project",
      goal: "Pause for approval before any execution.",
      approvalMode: "needs-approval"
    });

    await runner.runUntilStable(run.id, 8);
    const approval = (await approvalRequestStore.listPending())[0];

    if (!approval) {
      throw new Error("Expected a pending approval request.");
    }

    const failedRun = await runner.rejectRequest(approval.id);

    expect(failedRun.status).toBe("failed");
    expect(failedRun.pendingApprovalIds).toHaveLength(0);
  });

  it("waits for approval on a handoff and resumes after approval", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
    temporaryDirectories.push(rootPath);

    const { runner, approvalRequestStore } = await createRunner(rootPath, {
      providerOptions: {
        handoffApprovalModeByRole: {
          coordinator: "needs-approval"
        }
      }
    });

    const run = await runner.initializeRun({
      projectId: "demo-project",
      goal: "Pause on the first handoff."
    });

    const pausedRun = await runner.runUntilStable(run.id, 8);
    expect(pausedRun.status).toBe("waiting_approval");
    expect(pausedRun.completedTaskIds).toHaveLength(1);

    const approval = (await approvalRequestStore.listPending())[0];

    if (!approval) {
      throw new Error("Expected a pending approval request.");
    }

    expect(approval.subjectType).toBe("handoff");

    const completedRun = await runner.approveRequest(approval.id);

    expect(completedRun.status).toBe("completed");
    expect(completedRun.completedTaskIds).toHaveLength(4);
  });
});
