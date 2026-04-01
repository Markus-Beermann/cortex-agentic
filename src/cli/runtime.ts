import { FilesystemProjectAdapter } from "../adapters/projects/filesystem-project.adapter";
import { AnthropicProviderAdapter } from "../adapters/providers/anthropic-provider.adapter";
import { NoopProviderAdapter } from "../adapters/providers/noop-provider.adapter";
import type { ProviderPort } from "../adapters/providers/provider.port";
import type { ApprovalMode, RoleId } from "../core/contracts";
import { DefaultExecutionPolicy } from "../core/policies/execution-policy";
import { SessionRunner } from "../engine/session-runner";
import { getPool } from "../server/db";
import {
  DualWriteEventLogStore,
  DualWriteOutputStore,
  DualWriteRunStateStore,
  DualWriteTaskStore
} from "../server/dual-write-stores";
import { createDefaultRegistry } from "../state/default-registry";
import { ApprovalRequestStore } from "../state/approval-request.store";
import { EventLogStore } from "../state/event-log.store";
import { HandoffStore } from "../state/handoff.store";
import { OutputStore } from "../state/output.store";
import { RegistryStore } from "../state/registry.store";
import { RunStateStore } from "../state/run-state.store";
import { TaskStore } from "../state/task.store";

export interface CliRuntime {
  runner: SessionRunner;
  registryStore: RegistryStore;
  taskStore: TaskStore;
  outputStore: OutputStore;
  handoffStore: HandoffStore;
  approvalRequestStore: ApprovalRequestStore;
  runStateStore: RunStateStore;
  eventLogStore: EventLogStore;
}

export type CliProviderId = "noop" | "anthropic";

interface CliRuntimeOptions {
  providerId?: CliProviderId;
  handoffApprovalModeByRole?: Partial<Record<RoleId, ApprovalMode>>;
}

export async function createCliSessionRunner(rootPath: string): Promise<CliRuntime> {
  return createCliSessionRunnerWithOptions(rootPath, {});
}

export async function createCliSessionRunnerWithOptions(
  rootPath: string,
  options: CliRuntimeOptions
): Promise<CliRuntime> {
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const approvalRequestStore = new ApprovalRequestStore(rootPath);
  const taskStore = process.env.DATABASE_PUBLIC_URL
    ? new DualWriteTaskStore(rootPath, getPool())
    : new TaskStore(rootPath);
  const outputStore = process.env.DATABASE_PUBLIC_URL
    ? new DualWriteOutputStore(rootPath, getPool())
    : new OutputStore(rootPath);
  const handoffStore = new HandoffStore(rootPath);
  const runStateStore = process.env.DATABASE_PUBLIC_URL
    ? new DualWriteRunStateStore(rootPath, getPool())
    : new RunStateStore(rootPath);
  const eventLogStore = process.env.DATABASE_PUBLIC_URL
    ? new DualWriteEventLogStore(rootPath, getPool())
    : new EventLogStore(rootPath);
  const provider = createProvider(rootPath, options.providerId ?? "noop");

  const runner = new SessionRunner({
    provider,
    projectAdapter: new FilesystemProjectAdapter(rootPath),
    policy: new DefaultExecutionPolicy(),
    registryStore,
    taskStore,
    outputStore,
    handoffStore,
    approvalRequestStore,
    runStateStore,
    eventLogStore,
    handoffApprovalModeByRole: options.handoffApprovalModeByRole
  });

  return {
    runner,
    registryStore,
    taskStore,
    outputStore,
    handoffStore,
    approvalRequestStore,
    runStateStore,
    eventLogStore
  };
}

function createProvider(rootPath: string, providerId: CliProviderId): ProviderPort {
  switch (providerId) {
    case "noop":
      return new NoopProviderAdapter();
    case "anthropic":
      return new AnthropicProviderAdapter(rootPath);
  }
}
