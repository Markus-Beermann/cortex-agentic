import { describe, expect, it, vi } from "vitest";

import {
  normalizeEventTimestamp,
  pgGetChatHistory,
  pgGetLLMAssignment,
  pgListArchitectureSnapshots,
  pgListDeferredTasks,
  pgListEvents,
  pgListFeedItems,
  pgReleaseDeferredTask,
  pgSaveArchitectureSnapshot,
  pgSaveChatMessage,
  pgSaveDeferredTask,
  pgSetLLMAssignment
} from "../../src/server/pg-queries";

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

  it("saves a deferred task with normalized timestamps", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "task_1",
            addressee: "tony",
            goal: "Draft a presentation",
            context: { channel: "linkedin" },
            status: "pending",
            created_at: new Date("2026-04-03T07:00:00.000Z"),
            released_at: null,
            created_by: "markus"
          }
        ]
      })
    };

    const task = await pgSaveDeferredTask(pool as never, {
      addressee: "tony",
      goal: "Draft a presentation",
      context: { channel: "linkedin" }
    });

    expect(task).toEqual({
      id: "task_1",
      addressee: "tony",
      goal: "Draft a presentation",
      context: { channel: "linkedin" },
      status: "pending",
      createdAt: "2026-04-03T07:00:00.000Z",
      releasedAt: null,
      createdBy: "markus"
    });
  });

  it("saves a chat message with metadata", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 42,
            role: "assistant",
            content: "Debussy is online.",
            agent_id: "role/coordinator",
            repo_id: "Markus-Beermann/cortex-agentic",
            llm_id: "anthropic",
            created_at: new Date("2026-04-06T08:00:00.000Z")
          }
        ]
      })
    };

    const message = await pgSaveChatMessage(pool as never, {
      sessionId: "user_123",
      role: "assistant",
      content: "Debussy is online.",
      agentId: "role/coordinator",
      repoId: "Markus-Beermann/cortex-agentic",
      llmId: "anthropic"
    });

    expect(message).toEqual({
      id: 42,
      message: {
        role: "assistant",
        content: "Debussy is online."
      },
      agentId: "role/coordinator",
      repoId: "Markus-Beermann/cortex-agentic",
      llmId: "anthropic",
      createdAt: "2026-04-06T08:00:00.000Z"
    });
  });

  it("loads chat history in chronological order", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            role: "user",
            content: "Plan the next step."
          },
          {
            role: "assistant",
            content: "Start with the provider contract."
          }
        ]
      })
    };

    const history = await pgGetChatHistory(pool as never, "user_123");

    expect(history).toEqual([
      { role: "user", content: "Plan the next step." },
      { role: "assistant", content: "Start with the provider contract." }
    ]);
  });

  it("returns the latest llm assignment for an agent", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ llm_id: "openai-codex" }]
      })
    };

    const assignment = await pgGetLLMAssignment(pool as never, "role/coordinator");

    expect(assignment).toBe("openai-codex");
  });

  it("persists a new llm assignment", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    };

    await pgSetLLMAssignment(pool as never, "role/coordinator", "anthropic", "user_123");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO llm_assignments"),
      ["role/coordinator", "anthropic", "user_123"]
    );
  });

  it("lists deferred tasks with optional filters", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "task_2",
            addressee: "sigmund",
            goal: "Critique the ethical framing",
            context: null,
            status: "pending",
            created_at: "2026-04-03T08:00:00.000Z",
            released_at: null,
            created_by: "markus"
          }
        ]
      })
    };

    const tasks = await pgListDeferredTasks(pool as never, {
      addressee: "sigmund",
      status: "pending"
    });

    expect(tasks[0]?.addressee).toBe("sigmund");
    expect(tasks[0]?.status).toBe("pending");
  });

  it("releases a deferred task", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "task_3",
            addressee: "debussy",
            goal: "Route the next conversation",
            context: null,
            status: "released",
            created_at: "2026-04-03T09:00:00.000Z",
            released_at: "2026-04-03T09:15:00.000Z",
            created_by: "markus"
          }
        ]
      })
    };

    const task = await pgReleaseDeferredTask(pool as never, "task_3");

    expect(task?.status).toBe("released");
    expect(task?.releasedAt).toBe("2026-04-03T09:15:00.000Z");
  });

  it("saves architecture snapshots idempotently by stable id", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "snapshot/debussy",
            title: "Debussy Vision",
            mermaid: "graph TD\nA-->B",
            notes: "Seeded from docs",
            created_at: "2026-04-03T06:00:00.000Z"
          }
        ]
      })
    };

    const snapshot = await pgSaveArchitectureSnapshot(pool as never, {
      id: "snapshot/debussy",
      title: "Debussy Vision",
      mermaid: "graph TD\nA-->B",
      notes: "Seeded from docs"
    });

    expect(snapshot).toEqual({
      id: "snapshot/debussy",
      title: "Debussy Vision",
      mermaid: "graph TD\nA-->B",
      notes: "Seeded from docs",
      createdAt: "2026-04-03T06:00:00.000Z"
    });
  });

  it("lists architecture snapshots", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "snapshot_1",
            title: "Debussy Vision",
            mermaid: "graph TD\nA-->B",
            notes: null,
            created_at: "2026-04-03T06:00:00.000Z"
          }
        ]
      })
    };

    const snapshots = await pgListArchitectureSnapshots(pool as never);

    expect(snapshots[0]?.title).toBe("Debussy Vision");
    expect(snapshots[0]?.notes).toBeNull();
  });
});
