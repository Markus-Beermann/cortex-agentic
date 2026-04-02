import { randomUUID } from "node:crypto";

import type { ApprovalMode, Output, ProviderRequest, ProviderResponse, Task } from "../../core/contracts";
import type { ProviderPort } from "./provider.port";

function nowIso(): string {
  return new Date().toISOString();
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function isSimpleContentGoal(goal: string): boolean {
  const normalizedGoal = goal.toLowerCase();
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
  const engineeringKeywords = [
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

  return containsAny(normalizedGoal, contentKeywords) && !containsAny(normalizedGoal, engineeringKeywords);
}

function deriveTopic(goal: string): string {
  const normalizedGoal = goal.trim();
  const aboutMatch = normalizedGoal.match(/(?:about|über)\s+(.+)$/iu);

  if (aboutMatch?.[1]) {
    return aboutMatch[1].trim().replace(/[.?!]+$/u, "");
  }

  return "the requested topic";
}

function deriveArticlePath(goal: string): string {
  return goal.toLowerCase().includes("artikel") ? "artikel.md" : "article.md";
}

function buildArticleContent(goal: string): string {
  const topic = deriveTopic(goal);
  const title =
    topic === "the requested topic"
      ? "Requested Article"
      : `Article about ${topic.charAt(0).toUpperCase()}${topic.slice(1)}`;

  return [
    `# ${title}`,
    "",
    `This short article covers ${topic} in a form that can be reviewed without pretending a four-agent ceremony was necessary.`,
    "",
    `The first reference is [Wikipedia](https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/gu, "_"))}), which is at least a stable starting point instead of pure invention.`,
    `A second source is [MDN Web Docs](https://developer.mozilla.org/), useful when the topic touches implementation details or web-facing examples.`,
    `A third reference is [OpenAI documentation](https://platform.openai.com/docs), which is handy whenever the topic overlaps with agent workflows, structured outputs, or orchestration patterns.`,
    "",
    "## Summary",
    "",
    `- The task was treated as a bounded writing job about ${topic}.`,
    "- The deliverable is intentionally simple and file-based.",
    "- Review can be skipped because the output is directly inspectable on disk."
  ].join("\n");
}

export class NoopProviderAdapter implements ProviderPort {
  public readonly id = "noop";
  public readonly version = "v1" as const;

  public async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const timestamp = nowIso();
    const task = request.task;
    const personaName = request.personaName;
    const projectContext = request.projectContext;
    const selectedContext = request.selectedContext;
    const stackSummary = projectContext.stack.languages.join(", ") || "unknown stack";
    const focusSummary =
      selectedContext.focusPaths.length > 0
        ? selectedContext.focusPaths.slice(0, 3).join(", ")
        : "no focused paths";
    const output = this.buildOutput(
      task,
      personaName,
      projectContext,
      stackSummary,
      focusSummary,
      request.handoffApprovalMode,
      timestamp
    );

    return {
      providerId: this.id,
      adapterVersion: this.version,
      model: null,
      diagnostics: [
        `Selected context purpose: ${selectedContext.purpose}.`,
        `Focus paths considered: ${selectedContext.focusPaths.length}.`
      ],
      output
    };
  }

  private buildOutput(
    task: Task,
    personaName: string,
    projectContext: ProviderRequest["projectContext"],
    stackSummary: string,
    focusSummary: string,
    handoffApprovalMode: ApprovalMode,
    timestamp: string
  ): Output {
    switch (task.requestedRole) {
      case "coordinator":
        if (isSimpleContentGoal(task.objective)) {
          return {
            id: randomUUID(),
            taskId: task.id,
            roleId: "coordinator",
            summary: `${personaName} classified the goal "${task.objective}" as a bounded content task and skipped architecture work.`,
            decisions: [
              "The goal is simple enough for direct execution.",
              "A separate review hop is unnecessary because the deliverable can be inspected on disk."
            ],
            blockers: [],
            artifacts: [],
            nextAction: this.createHandoff(
              "implementer",
              "Write the requested article",
              task.objective,
              [
                "Create the requested article as a Markdown file.",
                "Include three links in the article body.",
                "Keep the deliverable project-relative and ready for immediate inspection."
              ],
              [
                `Original goal: ${task.objective}`,
                `Project root: ${projectContext.rootPath}`
              ],
              "The task is already bounded and does not need a separate architecture pass.",
              handoffApprovalMode
            ),
            createdAt: timestamp
          };
        }

        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "coordinator",
          summary: `${personaName} classified the goal "${task.objective}" and routed planning work.`,
          decisions: [
            "Start with explicit contracts.",
            `Route detailed planning to the architect role for a project using ${stackSummary}.`
          ],
          blockers: [],
          artifacts: [],
          nextAction: this.createHandoff(
            "architect",
            "Design the execution plan",
            `Decompose the goal into executable work packages for project ${task.projectId}.`,
            [
              "Define the first implementation slice.",
              "Keep the core project-agnostic."
            ],
            [
              `Original goal: ${task.objective}`,
              "Governance and operational bootstraps must remain separate."
            ],
            "Architect must turn the goal into execution-ready work.",
            handoffApprovalMode
          ),
          createdAt: timestamp
        };
      case "architect":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "architect",
          summary: `${personaName} translated the goal into a first implementation slice.`,
          decisions: [
            "Build contracts first.",
            `Use the structured project context from ${projectContext.rootPath}.`,
            `Prioritize focus paths: ${focusSummary}.`
          ],
          blockers: [],
          artifacts: [
            {
              kind: "decision",
              content: "Execution slice: contracts, state stores, orchestration loop, dry-run CLI."
            }
          ],
          nextAction: this.createHandoff(
            "implementer",
            "Implement the first orchestration slice",
            "Create the minimum executable core for George.",
            [
              "Persist runtime state to disk.",
              "Support a deterministic dry-run flow."
            ],
            [
              "Required artifacts: contracts, state stores, orchestration loop, CLI.",
              "Do not add provider-specific logic to the core."
            ],
            "Implementation can now proceed on bounded scope.",
            handoffApprovalMode
          ),
          createdAt: timestamp
        };
      case "implementer":
        if (isSimpleContentGoal(task.objective)) {
          return {
            id: randomUUID(),
            taskId: task.id,
            roleId: "implementer",
            summary: `${personaName} wrote the requested article directly into the sandbox project.`,
            decisions: [
              "The task was treated as a bounded writing deliverable.",
              `The file was prepared relative to ${projectContext.rootPath}.`
            ],
            blockers: [],
            artifacts: [
              {
                kind: "file",
                path: deriveArticlePath(task.objective),
                content: buildArticleContent(task.objective),
                note: "Materialize this Markdown file inside the selected project root."
              }
            ],
            nextAction: {
              kind: "complete"
            },
            createdAt: timestamp
          };
        }

        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "implementer",
          summary: `${personaName} completed the bounded execution slice.`,
          decisions: [
            "File-backed state is sufficient for Phase 1.",
            `Project documents available: ${projectContext.documents.length}.`,
            `Repository dirty state: ${projectContext.repository.isDirty}.`
          ],
          blockers: [],
          artifacts: [
            {
              kind: "note",
              content: `Implemented deterministic execution path for "${task.title}".`
            }
          ],
          nextAction: this.createHandoff(
            "reviewer",
            "Review the implementation slice",
            "Validate the first orchestration slice against its contracts and acceptance criteria.",
            [
              "Confirm the output contract is satisfied.",
              "Identify remaining risks explicitly."
            ],
            [
              "Review scope: contracts, state stores, orchestration loop, CLI.",
              "Do not widen scope during review."
            ],
            "Review is required before closing the run.",
            handoffApprovalMode
          ),
          createdAt: timestamp
        };
      case "reviewer":
        return {
          id: randomUUID(),
          taskId: task.id,
          roleId: "reviewer",
          summary: `${personaName} accepted the implementation slice and closed the run.`,
          decisions: [
            "Core contracts are explicit.",
            "The first deterministic loop is suitable for further extension."
          ],
          blockers: [],
          artifacts: [
            {
              kind: "decision",
              content: "Run completed without additional approval gates."
            }
          ],
          nextAction: {
            kind: "complete"
          },
          createdAt: timestamp
        };
    }
  }

  private createHandoff(
    targetRole: Task["requestedRole"],
    taskTitle: string,
    taskObjective: string,
    acceptanceCriteria: string[],
    context: string[],
    rationale: string,
    approvalMode: ApprovalMode
  ): Output["nextAction"] {
    return {
      kind: "handoff",
      targetRole,
      taskTitle,
      taskObjective,
      acceptanceCriteria,
      context,
      rationale,
      approvalMode
    };
  }
}
