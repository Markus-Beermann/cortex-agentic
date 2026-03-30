import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { ProviderRequest, ProviderResponse } from "../../core/contracts";
import {
  NextActionSchema,
  OutputDraftSchema,
  validateOutput
} from "../../core/contracts";
import { nowIso } from "../../state/file-store";
import type { ProviderPort } from "./provider.port";
import { PromptBuilder } from "./prompt-builder";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_TOOL_NAME = "submit_output_contract";
const NEXT_ACTION_TOOL_NAME = "repair_next_action";
const NextActionRepairSchema = z.object({
  nextAction: NextActionSchema
});

interface AnthropicTextContent {
  type: "text";
  text: string;
}

interface AnthropicToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicResponseBody {
  id: string;
  model: string;
  stop_reason: string | null;
  content: Array<AnthropicTextContent | AnthropicToolUseContent | { type: string }>;
  usage?: AnthropicUsage;
}

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

function buildOutputToolSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(OutputDraftSchema) as Record<string, unknown>;
  return { type: "object", ...schema };
}

function buildNextActionToolSchema(): Record<string, unknown> {
  return z.toJSONSchema(NextActionRepairSchema) as Record<string, unknown>;
}

function normalizeOutputDraft(request: ProviderRequest, value: unknown) {
  const draft = OutputDraftSchema.parse(value);

  return validateOutput({
    id: randomUUID(),
    taskId: request.taskId,
    roleId: request.roleId,
    summary: draft.summary,
    decisions: draft.decisions,
    blockers: draft.blockers,
    artifacts: draft.artifacts,
    nextAction: draft.nextAction,
    createdAt: nowIso()
  });
}

function extractToolUseInput(parsedBody: AnthropicResponseBody, toolName: string): unknown {
  const toolUseBlock = parsedBody.content.find(
    (item): item is AnthropicToolUseContent =>
      item.type === "tool_use" && "name" in item && item.name === toolName
  );

  if (toolUseBlock) {
    return toolUseBlock.input;
  }

  const textContent = parsedBody.content
    .filter((item): item is AnthropicTextContent => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();

  throw new Error(
    `Anthropic response did not call ${toolName}. Raw text was: ${textContent || "<empty>"}`
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingNextActionError(error: unknown): error is z.ZodError {
  return (
    error instanceof z.ZodError &&
    error.issues.some(
      (issue) => issue.path.length === 1 && issue.path[0] === "nextAction"
    )
  );
}

function canRepairMissingNextAction(error: unknown, toolInput: unknown): toolInput is Record<string, unknown> {
  return (
    isMissingNextActionError(error) &&
    isObjectRecord(toolInput) &&
    toolInput.nextAction === undefined
  );
}

export class AnthropicProviderAdapter implements ProviderPort {
  public readonly id = "anthropic";
  public readonly version = "v1" as const;

  private readonly promptBuilder: PromptBuilder;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;

  public constructor(
    repositoryRootPath: string,
    options: AnthropicProviderOptions = {}
  ) {
    this.promptBuilder = new PromptBuilder(repositoryRootPath);
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? 2;

    if (this.apiKey.length === 0) {
      throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider.");
    }
  }

  public async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = await this.promptBuilder.build(request);
    const diagnostics: string[] = [];
    const parsedBody = await this.createMessage({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      toolName: OUTPUT_TOOL_NAME,
      toolDescription:
        "Return the validated George output contract draft for the current task.",
      inputSchema: buildOutputToolSchema()
    });
    diagnostics.push(
      `Attempt 1 stop reason: ${parsedBody.stop_reason ?? "unknown"}.`,
      `Attempt 1 input tokens: ${parsedBody.usage?.input_tokens ?? 0}.`,
      `Attempt 1 output tokens: ${parsedBody.usage?.output_tokens ?? 0}.`
    );

    const initialToolInput = extractToolUseInput(parsedBody, OUTPUT_TOOL_NAME);

    try {
      const output = normalizeOutputDraft(request, initialToolInput);

      return {
        providerId: this.id,
        adapterVersion: this.version,
        model: parsedBody.model,
        diagnostics,
        output
      };
    } catch (error) {
      if (!canRepairMissingNextAction(error, initialToolInput) || this.maxAttempts < 2) {
        const message = error instanceof Error ? error.message : "Unknown normalization error.";
        throw new Error(
          `Anthropic response could not be normalized after 1 attempt(s): ${message}. Last model: ${parsedBody.model}.`
        );
      }

      const validationError = error as z.ZodError;
      const repairBody = await this.createMessage({
        systemPrompt: prompt.systemPrompt,
        userPrompt: [
          "The previous submit_output_contract tool input was missing the required nextAction object.",
          `Current partial payload: ${JSON.stringify(initialToolInput, null, 2)}`,
          `Validation problem: ${JSON.stringify(validationError.issues, null, 2)}`,
          `Return only the missing nextAction object by calling ${NEXT_ACTION_TOOL_NAME}.`
        ].join("\n"),
        toolName: NEXT_ACTION_TOOL_NAME,
        toolDescription:
          "Repair the missing nextAction object for the George output contract draft.",
        inputSchema: buildNextActionToolSchema()
      });

      diagnostics.push(
        `Attempt 2 stop reason: ${repairBody.stop_reason ?? "unknown"}.`,
        `Attempt 2 input tokens: ${repairBody.usage?.input_tokens ?? 0}.`,
        `Attempt 2 output tokens: ${repairBody.usage?.output_tokens ?? 0}.`
      );

      const repairedNextAction = NextActionRepairSchema.parse(
        extractToolUseInput(repairBody, NEXT_ACTION_TOOL_NAME)
      ).nextAction;
      const output = normalizeOutputDraft(request, {
        ...initialToolInput,
        nextAction: repairedNextAction
      });

      return {
        providerId: this.id,
        adapterVersion: this.version,
        model: repairBody.model,
        diagnostics,
        output
      };
    }
  }

  private async createMessage(input: {
    systemPrompt: string;
    userPrompt: string;
    toolName: string;
    toolDescription: string;
    inputSchema: Record<string, unknown>;
  }
  ): Promise<AnthropicResponseBody> {
    const { systemPrompt, userPrompt, toolName, toolDescription, inputSchema } = input;
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: [
          {
            name: toolName,
            description: toolDescription,
            input_schema: inputSchema
          }
        ],
        tool_choice: {
          type: "tool",
          name: toolName
        },
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed with ${response.status} ${response.statusText}: ${rawBody}`
      );
    }

    return JSON.parse(rawBody) as AnthropicResponseBody;
  }
}
