import Anthropic from "@anthropic-ai/sdk";

import type { ChatMessage, LLMProvider } from "../core/contracts";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;

function toAnthropicRole(role: ChatMessage["role"]): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

export class AnthropicProvider implements LLMProvider {
  public readonly id = "anthropic";
  public readonly displayName = "Claude (Anthropic)";

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  public constructor(options: { apiKey?: string; model?: string; maxTokens?: number } = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";

    if (apiKey.length === 0) {
      throw new Error("ANTHROPIC_API_KEY is required for the Anthropic LLM provider.");
    }

    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  public async chat(params: {
    systemPrompt: string;
    messages: ChatMessage[];
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: params.systemPrompt,
      messages: params.messages.map((message) => ({
        role: toAnthropicRole(message.role),
        content: message.content
      }))
    });

    const text = response.content
      .filter((part): part is Anthropic.TextBlock => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (text.length === 0) {
      throw new Error("Anthropic returned an empty chat response.");
    }

    return text;
  }
}
