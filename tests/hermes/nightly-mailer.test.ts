import { describe, expect, it, vi } from "vitest";

import { HermesNightlyMailer } from "../../src/hermes/nightly-mailer";

describe("HermesNightlyMailer", () => {
  it("polls, summarizes and sends the nightly digest", async () => {
    const mailer = new HermesNightlyMailer(
      {
        anthropicApiKey: "test",
        anthropicModel: "claude-sonnet-4-6",
        githubRepos: ["Markus-Beermann/YCSP", "Markus-Beermann/cortex-agentic"],
        githubLookbackHours: 72,
        nightlyLookbackHours: 24,
        resendApiKey: "re_test",
        mailFrom: "Hermes <hermes@example.com>",
        mailTo: "markus@example.com",
        cronSecret: "secret"
      },
      {
        upsert: vi.fn(),
        listSince: vi.fn().mockResolvedValue([
          {
            id: "feed_1",
            source: "github",
            eventType: "github.issue_opened",
            contentJson: { title: "Need better summaries" },
            createdAt: "2026-04-02T01:00:00.000Z",
            tags: ["feature_request"]
          }
        ])
      },
      {
        poll: vi.fn().mockResolvedValue({
          repositories: ["Markus-Beermann/cortex-agentic"],
          processed: 3,
          inserted: 2
        })
      } as never,
      {
        build: vi.fn().mockResolvedValue({
          subject: "Hermes nightly digest: one feature signal",
          summaryMarkdown: "- Feature request from GitHub"
        })
      } as never,
      {
        sendEmail: vi.fn().mockResolvedValue({ id: "email_123" })
      } as never
    );

    const result = await mailer.run();

    expect(result.insertedGitHubEvents).toBe(2);
    expect(result.digestedItems).toBe(1);
    expect(result.mailId).toBe("email_123");
    expect(result.subject).toBe("Hermes nightly digest: one feature signal");
  });
});
