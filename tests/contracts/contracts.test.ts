import { describe, expect, it } from "vitest";

import {
  OutputDraftSchema,
  OutputSchema,
  ReflectionReportSchema,
  RegistryEntrySchema,
  TaskSchema
} from "../../src/core/contracts";

describe("contracts", () => {
  it("accepts a valid task contract", () => {
    const result = TaskSchema.safeParse({
      id: "task-1",
      runId: "run-1",
      projectId: "project-1",
      title: "Coordinate work",
      objective: "Route the next role",
      requestedRole: "coordinator",
      constraints: [],
      inputContext: [],
      acceptanceCriteria: ["Pick the next role"],
      status: "queued",
      approvalMode: "auto",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(result.success).toBe(true);
  });

  it("rejects an output contract without a next action", () => {
    const result = OutputSchema.safeParse({
      id: "output-1",
      taskId: "task-1",
      roleId: "reviewer",
      summary: "Missing next action",
      decisions: [],
      blockers: [],
      artifacts: [],
      createdAt: new Date().toISOString()
    });

    expect(result.success).toBe(false);
  });

  it("accepts an output draft without runtime-managed fields", () => {
    const result = OutputDraftSchema.safeParse({
      summary: "Route the goal to architecture.",
      decisions: ["Classify the goal before implementation."],
      blockers: [],
      artifacts: [],
      nextAction: {
        kind: "handoff",
        targetRole: "architect",
        taskTitle: "Design the execution plan",
        taskObjective: "Turn the goal into bounded work packages.",
        acceptanceCriteria: ["Define the next implementation slice."],
        context: ["Original goal received."],
        rationale: "Architecture should define the next bounded task.",
        approvalMode: "auto"
      }
    });

    expect(result.success).toBe(true);
  });

  it("accepts a registry entry with stable role IDs and persona aliases", () => {
    const result = RegistryEntrySchema.safeParse({
      id: "role/coordinator",
      roleId: "coordinator",
      technicalName: "Coordinator",
      personaName: "George",
      aliases: ["George Senior"],
      displayName: "George",
      bootstrapPath: "docs/agent-context/roles/coordinator.bootstrap.md",
      capabilities: ["routing"],
      allowedHandoffs: ["architect"]
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid reflection report contract for Sigmund later", () => {
    const result = ReflectionReportSchema.safeParse({
      id: "reflection-1",
      runId: "run-1",
      taskId: null,
      perspective: "communication",
      summary: "The user needs tighter feedback loops and clearer disagreement.",
      observations: ["The user values directness over reassurance."],
      tensions: ["Too much abstraction reduces trust."],
      recommendations: ["Provide sharper intermediate checkpoints."],
      confidence: 0.82,
      createdAt: new Date().toISOString()
    });

    expect(result.success).toBe(true);
  });
});
