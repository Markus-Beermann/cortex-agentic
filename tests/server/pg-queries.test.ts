import { describe, expect, it, vi } from "vitest";

import { normalizeEventTimestamp, pgListEvents, pgListFeedItems } from "../../src/server/pg-queries";

describe("pgListEvents", () => {
  it("normalizes Date timestamps returned by pg", async () => {
    const timestamp = new Date("2026-04-01T08:30:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "event-1",
            run_id: "run-1",
            event_type: "run.initialized",
            timestamp,
            payload: { goal: "Test run" }
          }
        ]
      })
    };

    const events = await pgListEvents(pool as never, "run-1");

    expect(events).toEqual([
      {
        id: "event-1",
        runId: "run-1",
        eventType: "run.initialized",
        timestamp: "2026-04-01T08:30:00.000Z",
        payload: { goal: "Test run" }
      }
    ]);
  });

  it("keeps ISO timestamp strings untouched", () => {
    expect(normalizeEventTimestamp("2026-04-01T08:30:00.000Z")).toBe(
      "2026-04-01T08:30:00.000Z"
    );
  });

  it("rejects unsupported timestamp payloads", () => {
    expect(() => normalizeEventTimestamp(123)).toThrow(
      "Unsupported run event timestamp value: 123"
    );
  });

  it("maps feed items from PostgreSQL rows", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "feed_1",
            source: "linkedin",
            event_type: "linkedin.post",
            content_json: { text: "Interesting feedback" },
            created_at: new Date("2026-04-02T09:00:00.000Z"),
            processed_at: null,
            tags: ["feature_request"]
          }
        ]
      })
    };

    const items = await pgListFeedItems(pool as never, 10);

    expect(items).toEqual([
      {
        id: "feed_1",
        source: "linkedin",
        eventType: "linkedin.post",
        contentJson: { text: "Interesting feedback" },
        createdAt: "2026-04-02T09:00:00.000Z",
        processedAt: null,
        tags: ["feature_request"]
      }
    ]);
  });
});
