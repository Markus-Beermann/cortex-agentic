import type { ExecutionProfile, Handoff, ProjectContext, Task } from "../contracts";

export type PolicyDecisionStatus = "allowed" | "needs-approval" | "blocked";

export interface PolicyDecision {
  status: PolicyDecisionStatus;
  reason: string;
}

export interface ExecutionPolicy {
  canExecute(task: Task): PolicyDecision;
  canHandoff(handoff: Handoff): PolicyDecision;
  buildExecutionProfile(task: Task, projectContext: ProjectContext): ExecutionProfile;
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

export class DefaultExecutionPolicy implements ExecutionPolicy {
  public canExecute(task: Task): PolicyDecision {
    return this.evaluate(task.approvalMode);
  }

  public canHandoff(handoff: Handoff): PolicyDecision {
    return this.evaluate(handoff.approvalMode);
  }

  public buildExecutionProfile(task: Task, projectContext: ProjectContext): ExecutionProfile {
    const normalizedGoal = task.objective.toLowerCase();
    const contentKeywords = [
      "article",
      "artikel",
      "blog",
      "post",
      "essay",
      "summary",
      "documentation",
      "document",
      "write",
      "schreibe"
    ];
    const codeKeywords = [
      "api",
      "service",
      "microservice",
      "refactor",
      "migrate",
      "bug",
      "fix",
      "debug",
      "port",
      "engine",
      "typescript",
      "javascript",
      "python",
      "database"
    ];
    const analysisKeywords = [
      "review",
      "analyze",
      "analyse",
      "audit",
      "plan",
      "architecture",
      "architektur"
    ];

    if (containsAny(normalizedGoal, contentKeywords) && !containsAny(normalizedGoal, codeKeywords)) {
      return {
        workType: "content",
        complexity: "simple",
        routingStrategy: "direct-implementer",
        reviewMode: "skip-review",
        rationale: [
          "The goal reads like a bounded content deliverable.",
          "The result can be inspected directly as a file artifact."
        ]
      };
    }

    if (containsAny(normalizedGoal, analysisKeywords) && !containsAny(normalizedGoal, codeKeywords)) {
      return {
        workType: "analysis",
        complexity: "standard",
        routingStrategy: "plan-then-implement",
        reviewMode: "review-required",
        rationale: [
          "The goal emphasizes planning, review, or analysis work.",
          "The run should preserve a separate validation step."
        ]
      };
    }

    if (containsAny(normalizedGoal, codeKeywords)) {
      const isComplex =
        containsAny(normalizedGoal, ["microservice", "migrate", "migration", "database", "port"]) ||
        projectContext.repository.changedFiles.length > 8;

      return {
        workType: "code",
        complexity: isComplex ? "complex" : "standard",
        routingStrategy: isComplex ? "full-pipeline" : "plan-then-implement",
        reviewMode: "review-required",
        rationale: [
          "The goal references engineering or implementation-heavy work.",
          isComplex
            ? "The change surface suggests a full coordinator -> architect -> implementer -> reviewer path."
            : "Architecture planning is useful before implementation."
        ]
      };
    }

    return {
      workType: "unknown",
      complexity: "standard",
      routingStrategy: "plan-then-implement",
      reviewMode: "review-required",
      rationale: [
        "The goal does not match a safer direct-execution heuristic.",
        "Defaulting to planning preserves bounded scope."
      ]
    };
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
