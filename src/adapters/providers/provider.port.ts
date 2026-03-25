import type {
  Output,
  ProjectContext,
  RegistryEntry,
  RunState,
  Task
} from "../../core/contracts";

export interface ProviderExecutionContext {
  projectContext: ProjectContext;
  run: RunState;
  task: Task;
  role: RegistryEntry;
}

export interface ProviderPort {
  readonly id: string;
  execute(context: ProviderExecutionContext): Promise<Output>;
}
