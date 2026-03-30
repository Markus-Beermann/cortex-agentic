import { describe, expect, it } from "vitest";

import type { RunState, RunStatus } from "../../src/core/contracts";
import {
  filterRuns,
  parseRunListArguments
} from "../../src/cli/run-list.logic";

function createRun(id: string, status: RunStatus): RunState {
  return {
    id,
    projectId: "demo-project",
    goal: "Inspect human intervention points.",
    status,
    activeTaskId: null,
    pendingApprovalIds: status === "waiting_approval" ? ["approval-1"] : [],
    queuedTaskIds: [],
    completedTaskIds: [],
    outputIds: [],
    createdAt: "2026-03-30T09:00:00.000Z",
    updatedAt: "2026-03-30T09:00:00.000Z"
  };
}

describe("run:list", () => {
  it("parses the explicit waiting approval status filter", () => {
    expect(parseRunListArguments(["--status=waiting_approval"])).toEqual({
      status: "waiting_approval"
    });
  });

  it("filters runs down to waiting approval entries", () => {
    const runs = [
      createRun("run-1", "completed"),
      createRun("run-2", "waiting_approval"),
      createRun("run-3", "running")
    ];

    expect(
      filterRuns(runs, {
        status: "waiting_approval"
      }).map((run) => run.id)
    ).toEqual(["run-2"]);
  });

  it("rejects unsupported status arguments", () => {
    expect(() => parseRunListArguments(["--status=stuck"])).toThrow(
      'Invalid status "stuck".'
    );
  });
});
