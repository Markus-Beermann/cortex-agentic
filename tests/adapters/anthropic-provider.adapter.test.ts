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
    executionProfile: {
      workType: "code",
      complexity: "standard",
      routingStrategy: "plan-then-implement",
      reviewMode: "review-required",
      rationale: ["The goal should be planned before implementation."]
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
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "submit_output_contract",
              input: {
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
              }
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
      tool_choice: { type: string; name: string };
      tools: Array<{ name: string; input_schema: Record<string, unknown> }>;
    };
    expect(requestBody.model).toBe("claude-sonnet-4-6");
    expect(requestBody.system).toContain("Route work safely.");
    expect(requestBody.system).toContain("COORDINATOR ROUTING DIRECTIVE");
    expect(requestBody.system).toContain('The preferred routing strategy for this task is "plan-then-implement".');
    expect(requestBody.tool_choice).toEqual({
      type: "tool",
      name: "submit_output_contract"
    });
    expect(requestBody.tools[0]?.name).toBe("submit_output_contract");
    expect(requestBody.tools[0]?.input_schema).toMatchObject({
      type: "object",
      required: ["summary", "decisions", "blockers", "artifacts", "nextAction"]
    });
    expect(response.model).toBe("claude-sonnet-4-6");
    expect(response.output.taskId).toBe("task-1");
    expect(response.output.roleId).toBe("coordinator");
    expect(response.output.nextAction.kind).toBe("handoff");
    expect(response.diagnostics).toContain("Attempt 1 stop reason: tool_use.");
  });

  it("retries once when the first tool payload is invalid", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-anthropic-provider-"));
    temporaryDirectories.push(rootPath);

    const bootstrapPath = path.join(rootPath, "docs/agent-context/roles/coordinator.bootstrap.md");
    await mkdir(path.dirname(bootstrapPath), { recursive: true });
    await writeFile(
      bootstrapPath,
      "# Coordinator Bootstrap\n\nRoute work safely.\n",
      "utf8"
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_invalid",
            model: "claude-sonnet-4-6",
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                id: "toolu_invalid",
                name: "submit_output_contract",
                input: {
                  summary: "George started routing.",
                  decisions: ["Classify first."],
                  blockers: [],
                  artifacts: []
                }
              }
            ],
            usage: {
              input_tokens: 100,
              output_tokens: 20
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_repair",
            model: "claude-sonnet-4-6",
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                id: "toolu_repair",
                name: "repair_next_action",
                input: {
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
                }
              }
            ],
            usage: {
              input_tokens: 120,
              output_tokens: 40
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AnthropicProviderAdapter(rootPath, {
      apiKey: "test-key",
      maxAttempts: 2
    });
    const response = await adapter.execute(createProviderRequest());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const secondBody = JSON.parse(String(secondRequest.body)) as {
      tool_choice: { name: string };
      tools: Array<{ name: string; input_schema: Record<string, unknown> }>;
      messages: Array<{ content: string }>;
    };
    expect(secondBody.tool_choice.name).toBe("repair_next_action");
    expect(secondBody.tools[0]?.name).toBe("repair_next_action");
    expect(secondBody.tools[0]?.input_schema).toMatchObject({
      type: "object",
      required: ["nextAction"]
    });
    expect(secondBody.messages[0]?.content).toContain("missing the required nextAction object");
    expect(response.output.nextAction.kind).toBe("handoff");
    expect(
      response.diagnostics.some((entry) => entry.startsWith("Attempt 2 stop reason: tool_use."))
    ).toBe(true);
  });
});
