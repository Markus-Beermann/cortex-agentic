import OpenAI from "openai";

import type { ChatMessage, LLMProvider } from "../core/contracts";

const DEFAULT_MODEL = "o3";

export class OpenAIProvider implements LLMProvider {
  public readonly id = "openai-codex";
  public readonly displayName = "Codex (OpenAI)";

  private readonly client: OpenAI;
  private readonly model: string;

  public constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";

    if (apiKey.length === 0) {
      throw new Error("OPENAI_API_KEY is required for the OpenAI LLM provider.");
    }

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  public async chat(params: {
    systemPrompt: string;
    messages: ChatMessage[];
  }): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: params.systemPrompt,
      input: params.messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    });

    const text = response.output_text?.trim();

    if (!text) {
      throw new Error("OpenAI returned an empty chat response.");
    }

    return text;
  }
}
