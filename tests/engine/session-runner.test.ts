import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FilesystemProjectAdapter } from "../../src/adapters/projects/filesystem-project.adapter";
import { NoopProviderAdapter } from "../../src/adapters/providers/noop-provider.adapter";
import type { ApprovalMode, RoleId } from "../../src/core/contracts";
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
    handoffApprovalModeByRole?: Partial<Record<RoleId, ApprovalMode>>;
  } = {}
): Promise<{
  runner: SessionRunner;
  approvalRequestStore: ApprovalRequestStore;
  eventLogStore: EventLogStore;
  taskStore: TaskStore;
}> {
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const approvalRequestStore = new ApprovalRequestStore(rootPath);
  const eventLogStore = new EventLogStore(rootPath);
  const taskStore = new TaskStore(rootPath);

  return {
    approvalRequestStore,
    eventLogStore,
    taskStore,
    runner: new SessionRunner({
      provider: new NoopProviderAdapter(),
      projectAdapter: new FilesystemProjectAdapter(rootPath),
      policy: new DefaultExecutionPolicy(),
      registryStore,
      taskStore,
      outputStore: new OutputStore(rootPath),
      handoffStore: new HandoffStore(rootPath),
      approvalRequestStore,
      runStateStore: new RunStateStore(rootPath),
      eventLogStore,
      handoffApprovalModeByRole: options.handoffApprovalModeByRole
    })
  };
}

async function createWorkspaceRoot(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-runner-"));
  temporaryDirectories.push(rootPath);

  await mkdir(path.join(rootPath, "sandbox"), { recursive: true });
  await writeFile(path.join(rootPath, "AGENTS.md"), "# rules\n", "utf8");
  await writeFile(path.join(rootPath, "package.json"), "{}\n", "utf8");
  await writeFile(path.join(rootPath, "sandbox", "README.md"), "# Sandbox\n", "utf8");
  await writeFile(path.join(rootPath, "sandbox", "package.json"), "{}\n", "utf8");

  return rootPath;
}

describe("SessionRunner", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("completes the deterministic dry-run flow", async () => {
    const rootPath = await createWorkspaceRoot();

    const { runner, eventLogStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "sandbox",
      goal: "Build the first orchestration slice."
    });

    const completedRun = await runner.runUntilStable(run.id, 8);

    expect(completedRun.status).toBe("completed");
    expect(completedRun.completedTaskIds).toHaveLength(4);
    expect(completedRun.outputIds).toHaveLength(4);

    const events = await eventLogStore.list(run.id);
    expect(events.some((event) => event.eventType === "provider.executed")).toBe(true);
    expect(events.some((event) => event.eventType === "routing.profile_selected")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.eventType === "provider.executed" &&
          event.payload.contextPurpose === "planning"
      )
    ).toBe(true);
  });

  it("writes implementer file artifacts into the sandbox project and completes without review for simple article work", async () => {
    const rootPath = await createWorkspaceRoot();

    const { runner, eventLogStore, taskStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "sandbox",
      goal: "Schreibe einen mit 3 Links belegten Artikel über Multi-Agenten-Orchestrierung."
    });

    const completedRun = await runner.runUntilStable(run.id, 8);
    const tasks = await taskStore.listByRun(run.id);
    const articlePath = path.join(rootPath, "sandbox", "artikel.md");
    const articleContent = await readFile(articlePath, "utf8");
    const events = await eventLogStore.list(run.id);
    const routingEvent = events.find((event) => event.eventType === "routing.profile_selected");

    expect(completedRun.status).toBe("completed");
    expect(completedRun.completedTaskIds).toHaveLength(2);
    expect(completedRun.outputIds).toHaveLength(2);
    expect(tasks.map((task) => task.requestedRole)).toEqual(["coordinator", "implementer"]);
    expect(articleContent).toContain("# Article about Multi-Agenten-Orchestrierung");
    expect(articleContent.match(/\[.+?\]\(https?:\/\/.+?\)/gmu)).toHaveLength(3);
    expect(events.some((event) => event.eventType === "artifact.materialized")).toBe(true);
    expect(routingEvent?.payload.routingStrategy).toBe("direct-implementer");
    expect(routingEvent?.payload.reviewMode).toBe("skip-review");
  });

  it("stops at the approval gate when the root task requires approval", async () => {
    const rootPath = await createWorkspaceRoot();

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "sandbox",
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
    const rootPath = await createWorkspaceRoot();

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "sandbox",
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
    const rootPath = await createWorkspaceRoot();

    const { runner, approvalRequestStore } = await createRunner(rootPath);
    const run = await runner.initializeRun({
      projectId: "sandbox",
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
    const rootPath = await createWorkspaceRoot();

    const { runner, approvalRequestStore } = await createRunner(rootPath, {
      handoffApprovalModeByRole: {
        coordinator: "needs-approval"
      }
    });

    const run = await runner.initializeRun({
      projectId: "sandbox",
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
