import { nowIso } from "../state/file-store";
import type { FeedItem, FeedTag } from "./contracts";
import type { FeedItemStore } from "./feed-item.store";
import { buildFeedItemId } from "./feed-item.store";

interface GitHubRepositoryRef {
  owner: string;
  repo: string;
}

interface GitHubStarRow {
  starred_at: string;
  user: {
    id?: number;
    login: string;
    html_url?: string;
  };
}

interface GitHubForkRow {
  id: number;
  full_name: string;
  html_url: string;
  created_at: string;
  owner: {
    login: string;
  };
}

interface GitHubIssueRow {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  comments: number;
  pull_request?: unknown;
}

interface GitHubPrCommentRow {
  id: number;
  body: string;
  html_url: string;
  path: string | null;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
}

export interface GitHubPollResult {
  repositories: string[];
  processed: number;
  inserted: number;
}

export interface GitHubTagger {
  tag(input: {
    source: string;
    eventType: string;
    text: string;
    context?: string[];
  }): Promise<FeedTag[]>;
}

export interface GitHubPollerOptions {
  repositories: string[];
  feedItemStore: FeedItemStore;
  tagger: GitHubTagger;
  githubToken?: string;
  fetcher?: typeof fetch;
  now?: () => string;
}

export class GitHubPoller {
  private readonly fetcher: typeof fetch;
  private readonly now: () => string;

  public constructor(private readonly options: GitHubPollerOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? nowIso;
  }

  public async poll(sinceIso: string): Promise<GitHubPollResult> {
    let processed = 0;
    let inserted = 0;

    for (const repository of this.options.repositories) {
      const repoRef = parseRepository(repository);
      const candidates = await this.collectRepositoryCandidates(repoRef, sinceIso);

      for (const candidate of candidates) {
        processed += 1;
        const tags = await this.options.tagger.tag({
          source: "github",
          eventType: candidate.eventType,
          text: candidate.text,
          context: [repository, candidate.url]
        });

        const item: FeedItem = {
          id: buildFeedItemId({
            source: "github",
            eventType: candidate.eventType,
            externalId: candidate.externalId
          }),
          source: "github",
          eventType: candidate.eventType,
          createdAt: candidate.createdAt,
          tags,
          contentJson: candidate.contentJson
        };

        if (await this.options.feedItemStore.upsert(item)) {
          inserted += 1;
        }
      }
    }

    return {
      repositories: this.options.repositories,
      processed,
      inserted
    };
  }

  private async collectRepositoryCandidates(
    repository: GitHubRepositoryRef,
    sinceIso: string
  ): Promise<
    Array<{
      externalId: string;
      eventType: string;
      createdAt: string;
      url: string;
      text: string;
      contentJson: Record<string, unknown>;
    }>
  > {
    const stars = await this.fetchJson<GitHubStarRow[]>(
      `/repos/${repository.owner}/${repository.repo}/stargazers?per_page=100`,
      {
        accept: "application/vnd.github.star+json"
      }
    );
    const forks = await this.fetchJson<GitHubForkRow[]>(
      `/repos/${repository.owner}/${repository.repo}/forks?sort=newest&per_page=100`
    );
    const issues = await this.fetchJson<GitHubIssueRow[]>(
      `/repos/${repository.owner}/${repository.repo}/issues?state=all&sort=updated&direction=desc&per_page=100&since=${encodeURIComponent(
        sinceIso
      )}`
    );
    const comments = await this.fetchJson<GitHubPrCommentRow[]>(
      `/repos/${repository.owner}/${repository.repo}/pulls/comments?sort=updated&direction=desc&per_page=100&since=${encodeURIComponent(
        sinceIso
      )}`
    );

    return [
      ...stars
        .filter((row) => row.starred_at >= sinceIso)
        .map((row) => ({
          externalId: `${repository.owner}/${repository.repo}:star:${row.user.id ?? row.user.login}:${row.starred_at}`,
          eventType: "github.star",
          createdAt: row.starred_at,
          url: row.user.html_url ?? `https://github.com/${row.user.login}`,
          text: `${row.user.login} starred ${repository.owner}/${repository.repo}.`,
          contentJson: {
            repository: `${repository.owner}/${repository.repo}`,
            actor: row.user.login,
            actorUrl: row.user.html_url,
            occurredAt: row.starred_at
          }
        })),
      ...forks
        .filter((row) => row.created_at >= sinceIso)
        .map((row) => ({
          externalId: `${repository.owner}/${repository.repo}:fork:${row.id}`,
          eventType: "github.fork",
          createdAt: row.created_at,
          url: row.html_url,
          text: `${row.owner.login} forked ${repository.owner}/${repository.repo} into ${row.full_name}.`,
          contentJson: {
            repository: `${repository.owner}/${repository.repo}`,
            actor: row.owner.login,
            forkName: row.full_name,
            url: row.html_url,
            occurredAt: row.created_at
          }
        })),
      ...issues
        .filter((row) => !row.pull_request)
        .map((row) => ({
          externalId: `${repository.owner}/${repository.repo}:issue:${row.id}:${row.updated_at}`,
          eventType:
            row.created_at === row.updated_at ? "github.issue_opened" : "github.issue_updated",
          createdAt: row.updated_at,
          url: row.html_url,
          text: [row.title, row.body ?? ""].filter((entry) => entry.trim().length > 0).join("\n\n"),
          contentJson: {
            repository: `${repository.owner}/${repository.repo}`,
            number: row.number,
            state: row.state,
            title: row.title,
            body: row.body,
            author: row.user.login,
            url: row.html_url,
            comments: row.comments,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }
        })),
      ...comments.map((row) => ({
        externalId: `${repository.owner}/${repository.repo}:pr-comment:${row.id}:${row.updated_at}`,
        eventType: "github.pr_comment",
        createdAt: row.updated_at,
        url: row.html_url,
        text: row.body,
        contentJson: {
          repository: `${repository.owner}/${repository.repo}`,
          author: row.user.login,
          path: row.path,
          body: row.body,
          url: row.html_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      }))
    ].filter((candidate) => candidate.createdAt >= sinceIso);
  }

  private async fetchJson<T>(pathname: string, options?: { accept?: string }): Promise<T> {
    const response = await this.fetcher(`https://api.github.com${pathname}`, {
      headers: {
        accept: options?.accept ?? "application/vnd.github+json",
        "user-agent": "cortex-agentic-hermes",
        ...(this.options.githubToken
          ? { authorization: `Bearer ${this.options.githubToken}` }
          : {})
      },
      signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub request failed with ${response.status}: ${errorText}`);
    }

    return (await response.json()) as T;
  }
}

function parseRepository(value: string): GitHubRepositoryRef {
  const [owner, repo] = value.split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository reference: ${value}`);
  }

  return { owner, repo };
}
