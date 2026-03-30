import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  Output,
  ProviderRequest,
  ProviderResponse
} from "../../core/contracts";
import {
  NextActionSchema,
  OutputArtifactSchema,
  validateOutput
} from "../../core/contracts";
import { nowIso } from "../../state/file-store";
import type { ProviderPort } from "./provider.port";
import { PromptBuilder } from "./prompt-builder";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1800;
const DEFAULT_TIMEOUT_MS = 60_000;

const OutputDraftSchema = z.object({
  summary: z.string().min(1),
  decisions: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  artifacts: z.array(OutputArtifactSchema).default([]),
  nextAction: NextActionSchema
});

interface AnthropicTextContent {
  type: "text";
  text: string;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicResponseBody {
  id: string;
  model: string;
  stop_reason: string | null;
  content: Array<AnthropicTextContent | { type: string }>;
  usage?: AnthropicUsage;
}

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

function extractJsonObject(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/u) ?? text.match(/```\s*([\s\S]*?)```/u);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Anthropic response did not contain a JSON object.");
  }

  return text.slice(firstBrace, lastBrace + 1).trim();
}

function normalizeOutputDraft(request: ProviderRequest, value: unknown): Output {
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

export class AnthropicProviderAdapter implements ProviderPort {
  public readonly id = "anthropic";
  public readonly version = "v1" as const;

  private readonly promptBuilder: PromptBuilder;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  public constructor(
    repositoryRootPath: string,
    options: AnthropicProviderOptions = {}
  ) {
    this.promptBuilder = new PromptBuilder(repositoryRootPath);
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (this.apiKey.length === 0) {
      throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider.");
    }
  }

  public async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = await this.promptBuilder.build(request);
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
        system: prompt.systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt.userPrompt
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

    const parsedBody = JSON.parse(rawBody) as AnthropicResponseBody;
    const textContent = parsedBody.content
      .filter((item): item is AnthropicTextContent => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (textContent.length === 0) {
      throw new Error("Anthropic response did not contain any text content.");
    }

    const output = normalizeOutputDraft(
      request,
      JSON.parse(extractJsonObject(textContent))
    );

    return {
      providerId: this.id,
      adapterVersion: this.version,
      model: parsedBody.model,
      diagnostics: [
        `Stop reason: ${parsedBody.stop_reason ?? "unknown"}.`,
        `Input tokens: ${parsedBody.usage?.input_tokens ?? 0}.`,
        `Output tokens: ${parsedBody.usage?.output_tokens ?? 0}.`
      ],
      output
    };
  }
}
