import { describe, expect, it } from "vitest";

import type { ProjectContext, Task } from "../../src/core/contracts";
import { DefaultExecutionPolicy } from "../../src/core/policies/execution-policy";

function createProjectContext(changedFiles: string[] = []): ProjectContext {
  return {
    projectId: "sandbox",
    rootPath: "/tmp/workspace/sandbox",
    runtimePath: "/tmp/workspace/.orchestrator",
    documents: [],
    repository: {
      isGitRepo: true,
      currentBranch: "main",
      remotes: ["origin"],
      isDirty: changedFiles.length > 0,
      changedFiles,
      untrackedFiles: []
    },
    stack: {
      packageManager: "npm",
      manifests: ["sandbox/package.json"],
      configs: [],
      languages: ["TypeScript"]
    },
    focusPaths: [],
    contexts: {
      planningContext: {
        purpose: "planning",
        summary: "Plan safely.",
        focusPaths: [],
        relevantDocuments: [],
        notes: []
      },
      implementationContext: {
        purpose: "implementation",
        summary: "Implement safely.",
        focusPaths: [],
        relevantDocuments: [],
        notes: []
      },
      reviewContext: {
        purpose: "review",
        summary: "Review safely.",
        focusPaths: [],
        relevantDocuments: [],
        notes: []
      }
    },
    notes: []
  };
}

function createTask(objective: string): Task {
  return {
    id: "task-1",
    runId: "run-1",
    projectId: "sandbox",
    title: "Test task",
    objective,
    requestedRole: "coordinator",
    constraints: [],
    inputContext: [],
    acceptanceCriteria: ["Decide the next role."],
    status: "queued",
    approvalMode: "auto",
    createdAt: "2026-04-02T08:00:00.000Z",
    updatedAt: "2026-04-02T08:00:00.000Z"
  };
}

describe("DefaultExecutionPolicy", () => {
  it("routes simple content work directly to the implementer", () => {
    const policy = new DefaultExecutionPolicy();
    const executionProfile = policy.buildExecutionProfile(
      createTask("Schreibe einen Artikel über Multi-Agenten-Orchestrierung."),
      createProjectContext()
    );

    expect(executionProfile.routingStrategy).toBe("direct-implementer");
    expect(executionProfile.reviewMode).toBe("skip-review");
    expect(executionProfile.workType).toBe("content");
  });

  it("routes complex engineering work through the full pipeline", () => {
    const policy = new DefaultExecutionPolicy();
    const executionProfile = policy.buildExecutionProfile(
      createTask("Port a microservice database migration to TypeScript."),
      createProjectContext(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts", "src/f.ts", "src/g.ts", "src/h.ts", "src/i.ts"])
    );

    expect(executionProfile.routingStrategy).toBe("full-pipeline");
    expect(executionProfile.reviewMode).toBe("review-required");
    expect(executionProfile.complexity).toBe("complex");
  });
});
