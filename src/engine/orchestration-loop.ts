import type { RunState } from "../core/contracts";
import type { InitializeRunInput, SessionRunner } from "./session-runner";

export class OrchestrationLoop {
  public constructor(private readonly sessionRunner: SessionRunner) {}

  public async runGoal(
    input: InitializeRunInput,
    maxSteps = 8
  ): Promise<RunState> {
    const run = await this.sessionRunner.initializeRun(input);
    return this.sessionRunner.runUntilStable(run.id, maxSteps);
  }
}

