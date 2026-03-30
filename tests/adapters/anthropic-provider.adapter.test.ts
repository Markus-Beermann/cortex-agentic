import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProviderRequest } from "../../src/core/contracts";
import { AnthropicProviderAdapter } from "../../src/adapters/providers/anthropic-provider.adapter";

const temporaryDirectories: string[] = [];

function createProviderRequest(): ProviderRequest {
  return {
    id: "request-1",
    providerId: "anthropic",
    runId: "run-1",
    taskId: "task-1",
    roleId: "coordinator",
    technicalName: "Coordinator",
    personaName: "George",
    displayName: "George",
    bootstrapPath: "docs/agent-context/roles/coordinator.bootstrap.md",
    capabilities: ["routing"],
    allowedHandoffs: ["architect"],
    handoffApprovalMode: "auto",
    projectContext: {
      projectId: "project-1",
      rootPath: "/tmp/project-1",
      runtimePath: "/tmp/project-1/.orchestrator",
      documents: [],
      repository: {
        isGitRepo: true,
        currentBranch: "main",
        remotes: ["origin"],
        isDirty: false,
        changedFiles: [],
        untrackedFiles: []
      },
      stack: {
        packageManager: "npm",
        manifests: ["package.json"],
        configs: ["tsconfig.json"],
        languages: ["TypeScript"]
      },
      focusPaths: ["README.md"],
      contexts: {
        planningContext: {
          purpose: "planning",
          summary: "Focus on the orchestration plan.",
          focusPaths: ["README.md"],
          relevantDocuments: ["docs/architecture/orchestrator-architecture.md"],
          notes: []
        },
        implementationContext: {
          purpose: "implementation",
          summary: "Focus on changed files.",
          focusPaths: ["src/index.ts"],
          relevantDocuments: ["package.json"],
          notes: []
        },
        reviewContext: {
          purpose: "review",
          summary: "Focus on policy and changed files.",
          focusPaths: ["src/index.ts"],
          relevantDocuments: ["AGENTS.md"],
          notes: []
        }
      },
      notes: []
    },
    selectedContext: {
      purpose: "planning",
      summary: "Focus on the orchestration plan.",
      focusPaths: ["README.md"],
      relevantDocuments: ["docs/architecture/orchestrator-architecture.md"],
      notes: []
    },
    runProgress: {
      status: "running",
      activeTaskId: "task-1",
      pendingApprovalIds: [],
      queuedTaskIds: [],
      completedTaskIds: [],
      outputIds: [],
      completedWork: []
    },
    task: {
      id: "task-1",
      runId: "run-1",
      projectId: "project-1",
      title: "Coordinate the goal",
      objective: "Classify the goal and route the next role.",
      requestedRole: "coordinator",
      constraints: ["Keep the core project-agnostic."],
      inputContext: ["Goal received by George."],
      acceptanceCriteria: ["Route the next role explicitly."],
      status: "queued",
      approvalMode: "auto",
      createdAt: "2026-03-30T09:15:00.000Z",
      updatedAt: "2026-03-30T09:15:00.000Z"
    },
    createdAt: "2026-03-30T09:15:00.000Z"
  };
}

describe("AnthropicProviderAdapter", () => {
  afterEach(async () => {
    vi.restoreAllMocks();

    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("calls the Messages API and returns a validated output contract", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-anthropic-provider-"));
    temporaryDirectories.push(rootPath);

    const bootstrapPath = path.join(rootPath, "docs/agent-context/roles/coordinator.bootstrap.md");
    await mkdir(path.dirname(bootstrapPath), { recursive: true });
    await writeFile(
      bootstrapPath,
      "# Coordinator Bootstrap\n\nRoute work safely.\n",
      "utf8"
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "msg_123",
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "George routed the goal to architecture.",
                decisions: ["Classify the goal first."],
                blockers: [],
                artifacts: [],
                nextAction: {
                  kind: "handoff",
                  targetRole: "architect",
                  taskTitle: "Design the execution plan",
                  taskObjective: "Turn the goal into bounded work packages.",
                  acceptanceCriteria: ["Define the first implementation slice."],
                  context: ["Original goal received."],
                  rationale: "Architecture should define the next bounded task.",
                  approvalMode: "auto"
                }
              })
            }
          ],
          usage: {
            input_tokens: 123,
            output_tokens: 45
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AnthropicProviderAdapter(rootPath, {
      apiKey: "test-key"
    });
    const response = await adapter.execute(createProviderRequest());

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(requestInit.body)) as {
      model: string;
      system: string;
    };
    expect(requestBody.model).toBe("claude-sonnet-4-6");
    expect(requestBody.system).toContain("Route work safely.");
    expect(response.model).toBe("claude-sonnet-4-6");
    expect(response.output.taskId).toBe("task-1");
    expect(response.output.roleId).toBe("coordinator");
    expect(response.output.nextAction.kind).toBe("handoff");
    expect(response.diagnostics).toContain("Stop reason: end_turn.");
  });
});
