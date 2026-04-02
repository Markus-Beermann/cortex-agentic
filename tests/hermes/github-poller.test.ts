import { describe, expect, it, vi } from "vitest";

import { GitHubPoller } from "../../src/hermes/github-poller";

describe("GitHubPoller", () => {
  it("polls GitHub sources and stores tagged feed items", async () => {
    const upsert = vi.fn().mockResolvedValue(true);
    const tag = vi.fn().mockResolvedValue(["positive_signal"]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              starred_at: "2026-04-02T00:30:00.000Z",
              user: { id: 1, login: "alice", html_url: "https://github.com/alice" }
            }
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 2,
              full_name: "alice/cortex-agentic",
              html_url: "https://github.com/alice/cortex-agentic",
              created_at: "2026-04-02T01:00:00.000Z",
              owner: { login: "alice" }
            }
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 3,
              number: 42,
              title: "Support Hermes",
              body: "Please add a digest.",
              state: "open",
              html_url: "https://github.com/Markus-Beermann/cortex-agentic/issues/42",
              user: { login: "bob" },
              created_at: "2026-04-02T02:00:00.000Z",
              updated_at: "2026-04-02T02:30:00.000Z",
              comments: 1
            }
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 4,
              body: "Looks good to me.",
              html_url: "https://github.com/Markus-Beermann/cortex-agentic/pull/7#discussion_r1",
              path: "src/server/app.ts",
              created_at: "2026-04-02T03:00:00.000Z",
              updated_at: "2026-04-02T03:10:00.000Z",
              user: { login: "dino" }
            }
          ]),
          { status: 200 }
        )
      );

    const poller = new GitHubPoller({
      repositories: ["Markus-Beermann/cortex-agentic"],
      feedItemStore: {
        upsert,
        listSince: vi.fn()
      },
      tagger: { tag },
      fetcher: fetchMock
    });

    const result = await poller.poll("2026-04-02T00:00:00.000Z");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(tag).toHaveBeenCalledTimes(4);
    expect(upsert).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      repositories: ["Markus-Beermann/cortex-agentic"],
      processed: 4,
      inserted: 4
    });
  });
});
