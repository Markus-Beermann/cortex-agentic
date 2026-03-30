import { FilesystemProjectAdapter } from "../adapters/projects/filesystem-project.adapter";
import {
  NoopProviderAdapter,
  type NoopProviderOptions
} from "../adapters/providers/noop-provider.adapter";
import { DefaultExecutionPolicy } from "../core/policies/execution-policy";
import { SessionRunner } from "../engine/session-runner";
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

export async function createCliSessionRunner(rootPath: string): Promise<CliRuntime> {
  return createCliSessionRunnerWithOptions(rootPath, {});
}

export async function createCliSessionRunnerWithOptions(
  rootPath: string,
  options: {
    providerOptions?: NoopProviderOptions;
  }
): Promise<CliRuntime> {
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const approvalRequestStore = new ApprovalRequestStore(rootPath);
  const taskStore = new TaskStore(rootPath);
  const outputStore = new OutputStore(rootPath);
  const handoffStore = new HandoffStore(rootPath);
  const runStateStore = new RunStateStore(rootPath);
  const eventLogStore = new EventLogStore(rootPath);

  const runner = new SessionRunner({
    provider: new NoopProviderAdapter(options.providerOptions),
    projectAdapter: new FilesystemProjectAdapter(rootPath),
    policy: new DefaultExecutionPolicy(),
    registryStore,
    taskStore,
    outputStore,
    handoffStore,
    approvalRequestStore,
    runStateStore,
    eventLogStore
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
