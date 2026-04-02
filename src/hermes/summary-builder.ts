import { NightlyDigestSchema, type FeedItem, type NightlyDigest } from "./contracts";
import type { ClaudeClient } from "./claude-client";

export class HermesSummaryBuilder {
  public constructor(private readonly claudeClient: ClaudeClient) {}

  public async build(items: FeedItem[], sinceIso: string): Promise<NightlyDigest> {
    if (items.length === 0) {
      return {
        subject: "Hermes nightly digest: quiet day",
        summaryMarkdown: `No new GitHub or LinkedIn feed items since ${sinceIso}.`
      };
    }

    return this.claudeClient.generateStructured({
      systemPrompt: [
        "You write concise nightly monitoring summaries for Markus.",
        "Focus on actionable engineering signals, grouped by importance.",
        "Keep the tone direct and useful."
      ].join("\n"),
      userPrompt: [
        `Summarize the monitoring feed items collected since ${sinceIso}.`,
        "Return a short subject line and a markdown summary.",
        "",
        ...items.map((item, index) =>
          [
            `Item ${index + 1}`,
            `Source: ${item.source}`,
            `Event type: ${item.eventType}`,
            `Created at: ${item.createdAt}`,
            `Tags: ${item.tags.join(", ") || "none"}`,
            `Content: ${JSON.stringify(item.contentJson)}`
          ].join("\n")
        )
      ].join("\n\n"),
      schema: NightlyDigestSchema,
      toolName: "build_nightly_digest",
      toolDescription: "Build the nightly Hermes email digest subject and markdown body.",
      maxTokens: 1_500
    });
  }
}
