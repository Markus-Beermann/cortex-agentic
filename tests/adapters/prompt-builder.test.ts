import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ProviderRequest } from "../../src/core/contracts";
import { PromptBuilder } from "../../src/adapters/providers/prompt-builder";

const temporaryDirectories: string[] = [];

function createProviderRequest(): ProviderRequest {
  return {
    id: "request-1",
    providerId: "anthropic",
    runId: "run-1",
    taskId: "task-1",
    roleId: "architect",
    technicalName: "Architect",
    personaName: "Michael Angelo",
    displayName: "Michael Angelo",
    bootstrapPath: "docs/agent-context/roles/architect.bootstrap.md",
    capabilities: ["decomposition"],
    allowedHandoffs: ["implementer"],
    handoffApprovalMode: "needs-approval",
    projectContext: {
      projectId: "project-1",
      rootPath: "/tmp/project-1",
      runtimePath: "/tmp/project-1/.orchestrator",
      documents: [],
      repository: {
        isGitRepo: true,
        currentBranch: "main",
        remotes: ["origin"],
        isDirty: true,
        changedFiles: ["src/index.ts"],
        untrackedFiles: ["notes.md"]
      },
      stack: {
        packageManager: "npm",
        manifests: ["package.json"],
        configs: ["tsconfig.json"],
        languages: ["TypeScript"]
      },
      focusPaths: ["src/index.ts"],
      contexts: {
        planningContext: {
          purpose: "planning",
          summary: "Focus on architecture and governance.",
          focusPaths: ["README.md", "src/index.ts"],
          relevantDocuments: ["docs/architecture/orchestrator-architecture.md"],
          notes: ["The repo is currently dirty."]
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
          summary: "Focus on changed files and policy.",
          focusPaths: ["src/index.ts"],
          relevantDocuments: ["AGENTS.md"],
          notes: []
        }
      },
      notes: []
    },
    selectedContext: {
      purpose: "planning",
      summary: "Focus on architecture and governance.",
      focusPaths: ["README.md", "src/index.ts"],
      relevantDocuments: ["docs/architecture/orchestrator-architecture.md"],
      notes: ["The repo is currently dirty."]
    },
    runProgress: {
      status: "running",
      activeTaskId: "task-1",
      pendingApprovalIds: [],
      queuedTaskIds: ["task-2"],
      completedTaskIds: ["task-0"],
      outputIds: ["output-0"],
      completedWork: [
        {
          taskId: "task-0",
          roleId: "coordinator",
          title: "Coordinate the goal",
          objective: "Route the next role.",
          outputSummary: "George routed planning work.",
          nextActionKind: "handoff"
        }
      ]
    },
    task: {
      id: "task-1",
      runId: "run-1",
      projectId: "project-1",
      title: "Design the implementation plan",
      objective: "Turn the goal into bounded work packages.",
      requestedRole: "architect",
      constraints: ["Stay project-agnostic."],
      inputContext: ["Goal received by George."],
      acceptanceCriteria: ["Define the next implementation slice."],
      status: "queued",
      approvalMode: "auto",
      createdAt: "2026-03-30T09:10:00.000Z",
      updatedAt: "2026-03-30T09:10:00.000Z"
    },
    createdAt: "2026-03-30T09:10:00.000Z"
  };
}

describe("PromptBuilder", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("builds a prompt from bootstrap content, task data, and run progress", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-prompt-builder-"));
    temporaryDirectories.push(rootPath);

    const bootstrapPath = path.join(rootPath, "docs/agent-context/roles/architect.bootstrap.md");
    await mkdir(path.dirname(bootstrapPath), { recursive: true });
    await writeFile(
      bootstrapPath,
      "# Architect Bootstrap\n\nTurn goals into bounded work.\n",
      "utf8"
    );

    const builder = new PromptBuilder(rootPath);
    const prompt = await builder.build(createProviderRequest());

    expect(prompt.systemPrompt).toContain("Turn goals into bounded work.");
    expect(prompt.systemPrompt).toContain("Turn the goal into bounded work packages.");
    expect(prompt.systemPrompt).toContain("George routed planning work.");
    expect(prompt.systemPrompt).toContain('If you hand off, use approvalMode "needs-approval".');
    expect(prompt.userPrompt).toContain('task "Design the implementation plan"');
  });
});
