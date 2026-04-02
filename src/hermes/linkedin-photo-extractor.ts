import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { nowIso } from "../state/file-store";
import type { FeedItem } from "./contracts";
import { LinkedInPhotoExtractionSchema } from "./contracts";
import type { ClaudeClient } from "./claude-client";
import type { FeedItemStore } from "./feed-item.store";
import { buildFeedItemId } from "./feed-item.store";
import type { GitHubTagger } from "./github-poller";

export interface LinkedInIngestResult {
  item: FeedItem;
  inserted: boolean;
}

export class LinkedInPhotoExtractor {
  public constructor(
    private readonly claudeClient: ClaudeClient,
    private readonly feedItemStore: FeedItemStore,
    private readonly tagger: GitHubTagger
  ) {}

  public async ingest(input: {
    imagePath: string;
    context?: string;
  }): Promise<LinkedInIngestResult> {
    const fileBuffer = await readFile(input.imagePath);
    const mediaType = detectImageMediaType(input.imagePath);
    const imageHash = createHash("sha256").update(fileBuffer).digest("hex");

    const extraction = await this.claudeClient.generateStructured({
      systemPrompt: [
        "You extract structured LinkedIn feedback from screenshots for a private monitoring agent.",
        "Only return what is visible or strongly implied by the screenshot."
      ].join("\n"),
      userPrompt: [
        "Extract the LinkedIn feedback screenshot into structured fields.",
        input.context ? `Additional context from the operator: ${input.context}` : ""
      ]
        .filter((entry) => entry.length > 0)
        .join("\n"),
      schema: LinkedInPhotoExtractionSchema,
      toolName: "extract_linkedin_feedback",
      toolDescription: "Extract author, text, timestamp and context from the LinkedIn screenshot.",
      image: {
        mediaType,
        data: fileBuffer.toString("base64")
      },
      maxTokens: 1_024
    });

    const tags = await this.tagger.tag({
      source: "linkedin",
      eventType: "linkedin.post",
      text: extraction.text,
      context: [extraction.author ?? "unknown author", input.context ?? ""].filter(
        (entry) => entry.trim().length > 0
      )
    });

    const item: FeedItem = {
      id: buildFeedItemId({
        source: "linkedin",
        eventType: "linkedin.post",
        externalId: imageHash
      }),
      source: "linkedin",
      eventType: "linkedin.post",
      createdAt: nowIso(),
      tags,
      contentJson: {
        author: extraction.author,
        text: extraction.text,
        timestampText: extraction.timestampText,
        context: extraction.context ?? input.context,
        postUrl: extraction.postUrl,
        imagePath: path.resolve(input.imagePath)
      }
    };

    const inserted = await this.feedItemStore.upsert(item);

    return { item, inserted };
  }
}

export function detectImageMediaType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(`Unsupported screenshot type: ${extension || "<none>"}`);
  }
}
