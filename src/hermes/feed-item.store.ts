import { createHash } from "node:crypto";

import type { Pool } from "pg";

import type { FeedItem } from "./contracts";
import { validateFeedItem } from "./contracts";

export interface FeedItemStore {
  upsert(item: FeedItem): Promise<boolean>;
  listSince(sinceIso: string): Promise<FeedItem[]>;
}

export class PgFeedItemStore implements FeedItemStore {
  public constructor(private readonly pool: Pool) {}

  public async upsert(item: FeedItem): Promise<boolean> {
    const validatedItem = validateFeedItem(item);
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO feed_items (id, source, event_type, content_json, created_at, tags)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::text[])
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        validatedItem.id,
        validatedItem.source,
        validatedItem.eventType,
        JSON.stringify(validatedItem.contentJson),
        validatedItem.createdAt,
        validatedItem.tags
      ]
    );

    return result.rows.length > 0;
  }

  public async listSince(sinceIso: string): Promise<FeedItem[]> {
    const result = await this.pool.query<{
      id: string;
      source: FeedItem["source"];
      event_type: string;
      content_json: unknown;
      created_at: string | Date;
      tags: string[];
    }>(
      `SELECT id, source, event_type, content_json, created_at, tags
       FROM feed_items
       WHERE created_at >= $1
       ORDER BY created_at DESC`,
      [sinceIso]
    );

    return result.rows.map((row) =>
      validateFeedItem({
        id: row.id,
        source: row.source,
        eventType: row.event_type,
        contentJson: row.content_json,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        tags: row.tags
      })
    );
  }
}

export function buildFeedItemId(input: {
  source: FeedItem["source"];
  eventType: string;
  externalId: string;
}): string {
  const digest = createHash("sha256")
    .update(`${input.source}:${input.eventType}:${input.externalId}`)
    .digest("hex");

  return `feed_${digest.slice(0, 24)}`;
}
