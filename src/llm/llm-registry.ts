import type { LLMProvider } from "../core/contracts";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";

type ProviderFactory = {
  displayName: string;
  create: () => LLMProvider;
};

const providerFactories = new Map<string, ProviderFactory>([
  [
    "anthropic",
    {
      displayName: "Claude (Anthropic)",
      create: () => new AnthropicProvider()
    }
  ],
  [
    "openai-codex",
    {
      displayName: "Codex (OpenAI)",
      create: () => new OpenAIProvider()
    }
  ]
]);

const providerCache = new Map<string, LLMProvider>();

export function listLLMProviders(): Array<{ id: string; displayName: string }> {
  return Array.from(providerFactories.entries()).map(([id, definition]) => ({
    id,
    displayName: definition.displayName
  }));
}

export function getLLMProvider(id: string): LLMProvider {
  const cachedProvider = providerCache.get(id);

  if (cachedProvider) {
    return cachedProvider;
  }

  const definition = providerFactories.get(id);

  if (!definition) {
    throw new Error(`Unknown LLM provider: ${id}`);
  }

  const provider = definition.create();
  providerCache.set(id, provider);
  return provider;
}
