import { describe, expect, it } from "vitest";

import { OutputSchema, RegistryEntrySchema, TaskSchema } from "../../src/core/contracts";

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
});
