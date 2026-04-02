import { describe, expect, it, vi } from "vitest";

import { buildFeedItemId, PgFeedItemStore } from "../../src/hermes/feed-item.store";

describe("feed-item.store", () => {
  it("builds stable feed item IDs", () => {
    expect(
      buildFeedItemId({
        source: "github",
        eventType: "github.issue_opened",
        externalId: "repo:issue:123"
      })
    ).toBe(
      buildFeedItemId({
        source: "github",
        eventType: "github.issue_opened",
        externalId: "repo:issue:123"
      })
    );
  });

  it("maps rows from PostgreSQL back into feed items", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "feed_1",
            source: "github",
            event_type: "github.star",
            content_json: { repository: "Markus-Beermann/cortex-agentic" },
            created_at: new Date("2026-04-02T00:00:00.000Z"),
            tags: ["positive_signal"]
          }
        ]
      })
    };

    const store = new PgFeedItemStore(pool as never);
    const items = await store.listSince("2026-04-01T00:00:00.000Z");

    expect(items).toEqual([
      {
        id: "feed_1",
        source: "github",
        eventType: "github.star",
        contentJson: { repository: "Markus-Beermann/cortex-agentic" },
        createdAt: "2026-04-02T00:00:00.000Z",
        tags: ["positive_signal"]
      }
    ]);
  });
});
