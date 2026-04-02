import { z } from "zod";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

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

interface AnthropicResponseBody {
  id: string;
  model: string;
  content: Array<AnthropicTextContent | AnthropicToolUseContent | { type: string }>;
}

export interface ClaudeClientOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
}

export interface VisionImageInput {
  mediaType: string;
  data: string;
}

export class ClaudeClient {
  private readonly fetcher: typeof fetch;

  public constructor(private readonly options: ClaudeClientOptions) {
    if (options.apiKey.length === 0) {
      throw new Error("ANTHROPIC_API_KEY is required for Hermes.");
    }
    this.fetcher = options.fetcher ?? fetch;
  }

  public async generateStructured<TSchema extends z.ZodType>(
    input: {
      systemPrompt: string;
      userPrompt: string;
      schema: TSchema;
      toolName: string;
      toolDescription: string;
      image?: VisionImageInput;
      maxTokens?: number;
    }
  ): Promise<z.infer<TSchema>> {
    const response = await this.fetcher(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.options.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: input.systemPrompt,
        tools: [
          {
            name: input.toolName,
            description: input.toolDescription,
            input_schema: z.toJSONSchema(input.schema)
          }
        ],
        tool_choice: {
          type: "tool",
          name: input.toolName
        },
        messages: [
          {
            role: "user",
            content: buildUserContent(input.userPrompt, input.image)
          }
        ]
      }),
      signal: AbortSignal.timeout(120_000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic request failed with ${response.status}: ${errorText}`);
    }

    const parsedBody = (await response.json()) as AnthropicResponseBody;
    const toolInput = extractToolInput(parsedBody, input.toolName);

    return input.schema.parse(toolInput);
  }
}

function buildUserContent(userPrompt: string, image?: VisionImageInput) {
  if (!image) {
    return userPrompt;
  }

  return [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.data
      }
    },
    {
      type: "text",
      text: userPrompt
    }
  ];
}

function extractToolInput(parsedBody: AnthropicResponseBody, toolName: string): unknown {
  const toolUse = parsedBody.content.find(
    (item): item is AnthropicToolUseContent =>
      item.type === "tool_use" && "name" in item && item.name === toolName
  );

  if (toolUse) {
    return toolUse.input;
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
