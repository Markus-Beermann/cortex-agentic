import { describe, expect, it } from "vitest";

import { getLLMProvider, listLLMProviders } from "../../src/llm/llm-registry";

describe("llm-registry", () => {
  it("lists the supported LLM providers without instantiating them", () => {
    expect(listLLMProviders()).toEqual([
      { id: "anthropic", displayName: "Claude (Anthropic)" },
      { id: "openai-codex", displayName: "Codex (OpenAI)" }
    ]);
  });

  it("throws for an unknown provider id", () => {
    expect(() => getLLMProvider("imaginary-model")).toThrow(
      "Unknown LLM provider: imaginary-model"
    );
  });
});
