import type { Handoff, Task } from "../contracts";

export type PolicyDecisionStatus = "allowed" | "needs-approval" | "blocked";

export interface PolicyDecision {
  status: PolicyDecisionStatus;
  reason: string;
}

export interface ExecutionPolicy {
  canExecute(task: Task): PolicyDecision;
  canHandoff(handoff: Handoff): PolicyDecision;
}

export class DefaultExecutionPolicy implements ExecutionPolicy {
  public canExecute(task: Task): PolicyDecision {
    return this.evaluate(task.approvalMode);
  }

  public canHandoff(handoff: Handoff): PolicyDecision {
    return this.evaluate(handoff.approvalMode);
  }

  private evaluate(mode: Task["approvalMode"] | Handoff["approvalMode"]): PolicyDecision {
    switch (mode) {
      case "auto":
        return { status: "allowed", reason: "Automatic execution is allowed." };
      case "needs-approval":
        return { status: "needs-approval", reason: "Manual approval is required." };
      case "blocked":
        return { status: "blocked", reason: "Execution is blocked by policy." };
    }
  }
}

