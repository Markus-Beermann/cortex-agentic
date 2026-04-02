import { z } from "zod";

import type { FeedTag } from "./contracts";
import { FeedTaggingResultSchema } from "./contracts";
import type { ClaudeClient } from "./claude-client";

const TAGGING_SCHEMA = FeedTaggingResultSchema;

export class FeedTagger {
  public constructor(private readonly claudeClient: ClaudeClient) {}

  public async tag(input: {
    source: string;
    eventType: string;
    text: string;
    context?: string[];
  }): Promise<FeedTag[]> {
    const trimmedText = input.text.trim();

    if (trimmedText.length === 0) {
      return ["noise"];
    }

    const result = await this.claudeClient.generateStructured({
      systemPrompt: [
        "You classify monitoring feed items for a private engineering agent named Hermes.",
        "Return 1 to 3 tags only from the allowed tag set.",
        "Use feature_request for explicit product asks, bug for defects or broken behavior,",
        "positive_signal for praise or strong adoption signals, question for open user questions,",
        "and noise for low-value chatter or irrelevant content."
      ].join("\n"),
      userPrompt: [
        `Source: ${input.source}`,
        `Event type: ${input.eventType}`,
        "Context:",
        ...(input.context ?? []).map((entry) => `- ${entry}`),
        "Content:",
        trimmedText
      ].join("\n"),
      schema: TAGGING_SCHEMA,
      toolName: "classify_feed_item",
      toolDescription: "Classify the feed item with the allowed Hermes monitoring tags.",
      maxTokens: 512
    });

    return result.tags;
  }
}
