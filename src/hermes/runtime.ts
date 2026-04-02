import type { Pool } from "pg";

import { ClaudeClient } from "./claude-client";
import { assertAnthropicApiKey, getHermesConfig } from "./config";
import { PgFeedItemStore } from "./feed-item.store";
import { GitHubPoller } from "./github-poller";
import { LinkedInPhotoExtractor } from "./linkedin-photo-extractor";
import { HermesNightlyMailer } from "./nightly-mailer";
import { ResendClient } from "./resend-client";
import { HermesSummaryBuilder } from "./summary-builder";
import { FeedTagger } from "./tagger";

export function createHermesRuntime(pool: Pool) {
  const config = getHermesConfig();
  const claudeClient = new ClaudeClient({
    apiKey: assertAnthropicApiKey(config),
    model: config.anthropicModel
  });
  const feedItemStore = new PgFeedItemStore(pool);
  const tagger = new FeedTagger(claudeClient);
  const githubPoller = new GitHubPoller({
    repositories: config.githubRepos,
    feedItemStore,
    tagger,
    githubToken: config.githubToken
  });
  const summaryBuilder = new HermesSummaryBuilder(claudeClient);
  const linkedinPhotoExtractor = new LinkedInPhotoExtractor(claudeClient, feedItemStore, tagger);

  return {
    config,
    feedItemStore,
    tagger,
    githubPoller,
    summaryBuilder,
    linkedinPhotoExtractor,
    createNightlyMailer() {
      const resendClient = new ResendClient({
        apiKey: config.resendApiKey ?? ""
      });

      return new HermesNightlyMailer(
        config,
        feedItemStore,
        githubPoller,
        summaryBuilder,
        resendClient
      );
    }
  };
}
