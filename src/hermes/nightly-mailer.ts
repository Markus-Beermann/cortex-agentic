import { nowIso } from "../state/file-store";
import { assertMailerConfig, type HermesConfig } from "./config";
import type { FeedItemStore } from "./feed-item.store";
import type { GitHubPoller, GitHubPollResult } from "./github-poller";
import type { ResendClient } from "./resend-client";
import type { HermesSummaryBuilder } from "./summary-builder";

export interface NightlyRunResult {
  since: string;
  polledRepositories: string[];
  processedGitHubEvents: number;
  insertedGitHubEvents: number;
  digestedItems: number;
  mailId: string;
  subject: string;
}

export class HermesNightlyMailer {
  public constructor(
    private readonly config: HermesConfig,
    private readonly feedItemStore: FeedItemStore,
    private readonly githubPoller: GitHubPoller,
    private readonly summaryBuilder: HermesSummaryBuilder,
    private readonly resendClient: ResendClient
  ) {}

  public async run(input?: { summaryLookbackHours?: number; githubLookbackHours?: number }): Promise<NightlyRunResult> {
    const githubSince = hoursAgoIso(input?.githubLookbackHours ?? this.config.githubLookbackHours);
    const pollResult = await this.githubPoller.poll(githubSince);

    const summarySince = hoursAgoIso(
      input?.summaryLookbackHours ?? this.config.nightlyLookbackHours
    );
    const feedItems = await this.feedItemStore.listSince(summarySince);
    const digest = await this.summaryBuilder.build(feedItems, summarySince);
    const mailConfig = assertMailerConfig(this.config);
    const mailResult = await this.resendClient.sendEmail({
      from: mailConfig.mailFrom,
      to: mailConfig.mailTo,
      subject: digest.subject,
      text: digest.summaryMarkdown
    });

    return {
      since: summarySince,
      polledRepositories: pollResult.repositories,
      processedGitHubEvents: pollResult.processed,
      insertedGitHubEvents: pollResult.inserted,
      digestedItems: feedItems.length,
      mailId: mailResult.id,
      subject: digest.subject
    };
  }
}

function hoursAgoIso(hours: number): string {
  const now = new Date(nowIso()).getTime();
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}
