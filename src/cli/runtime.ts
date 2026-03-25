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

export async function createCliSessionRunner(rootPath: string): Promise<{
  runner: SessionRunner;
  approvalRequestStore: ApprovalRequestStore;
}> {
  return createCliSessionRunnerWithOptions(rootPath, {});
}

export async function createCliSessionRunnerWithOptions(
  rootPath: string,
  options: {
    providerOptions?: NoopProviderOptions;
  }
): Promise<{
  runner: SessionRunner;
  approvalRequestStore: ApprovalRequestStore;
}> {
  const registryStore = new RegistryStore(rootPath);
  await registryStore.seed(createDefaultRegistry());

  const approvalRequestStore = new ApprovalRequestStore(rootPath);

  const runner = new SessionRunner({
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
  });

  return {
    runner,
    approvalRequestStore
  };
}
