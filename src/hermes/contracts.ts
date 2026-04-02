import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "../core/contracts";

export const FeedItemSourceSchema = z.enum(["github", "linkedin"]);
export const FeedTagSchema = z.enum([
  "feature_request",
  "bug",
  "positive_signal",
  "question",
  "noise"
]);

export const FeedItemSchema = z.object({
  id: IdentifierSchema,
  source: FeedItemSourceSchema,
  eventType: z.string().min(1),
  contentJson: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema,
  tags: z.array(FeedTagSchema).default([])
});

export const FeedTaggingResultSchema = z.object({
  tags: z.array(FeedTagSchema).min(1).max(3)
});

export const LinkedInPhotoExtractionSchema = z.object({
  author: z.string().min(1).optional(),
  text: z.string().min(1),
  timestampText: z.string().min(1).optional(),
  context: z.string().min(1).optional(),
  postUrl: z.string().url().optional()
});

export const NightlyDigestSchema = z.object({
  subject: z.string().min(1),
  summaryMarkdown: z.string().min(1)
});

export type FeedItemSource = z.infer<typeof FeedItemSourceSchema>;
export type FeedTag = z.infer<typeof FeedTagSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedTaggingResult = z.infer<typeof FeedTaggingResultSchema>;
export type LinkedInPhotoExtraction = z.infer<typeof LinkedInPhotoExtractionSchema>;
export type NightlyDigest = z.infer<typeof NightlyDigestSchema>;

export function validateFeedItem(value: unknown): FeedItem {
  return FeedItemSchema.parse(value);
}
