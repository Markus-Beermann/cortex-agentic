const DEFAULT_GITHUB_REPOS = ["Markus-Beermann/ycsp", "Markus-Beermann/cortex-agentic"];
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_GITHUB_LOOKBACK_HOURS = 72;
const DEFAULT_NIGHTLY_LOOKBACK_HOURS = 24;

export interface HermesConfig {
  anthropicApiKey: string;
  anthropicModel: string;
  githubRepos: string[];
  githubToken?: string;
  githubLookbackHours: number;
  nightlyLookbackHours: number;
  resendApiKey?: string;
  mailFrom?: string;
  mailTo?: string;
  cronSecret?: string;
}

export function getHermesConfig(env: NodeJS.ProcessEnv = process.env): HermesConfig {
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
    anthropicModel: env.HERMES_ANTHROPIC_MODEL ?? env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    githubRepos: parseCsv(env.HERMES_GITHUB_REPOS, DEFAULT_GITHUB_REPOS),
    githubToken: env.HERMES_GITHUB_TOKEN,
    githubLookbackHours: parsePositiveInt(
      env.HERMES_GITHUB_LOOKBACK_HOURS,
      DEFAULT_GITHUB_LOOKBACK_HOURS
    ),
    nightlyLookbackHours: parsePositiveInt(
      env.HERMES_NIGHTLY_LOOKBACK_HOURS,
      DEFAULT_NIGHTLY_LOOKBACK_HOURS
    ),
    resendApiKey: env.RESEND_API_KEY,
    mailFrom: env.HERMES_MAIL_FROM,
    mailTo: env.HERMES_MAIL_TO,
    cronSecret: env.HERMES_CRON_SECRET
  };
}

export function assertAnthropicApiKey(config: HermesConfig): string {
  if (config.anthropicApiKey.length === 0) {
    throw new Error("ANTHROPIC_API_KEY is required for Hermes.");
  }
  return config.anthropicApiKey;
}

export function assertMailerConfig(config: HermesConfig): {
  resendApiKey: string;
  mailFrom: string;
  mailTo: string;
} {
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is required for Hermes nightly mail.");
  }
  if (!config.mailFrom) {
    throw new Error("HERMES_MAIL_FROM is required for Hermes nightly mail.");
  }
  if (!config.mailTo) {
    throw new Error("HERMES_MAIL_TO is required for Hermes nightly mail.");
  }

  return {
    resendApiKey: config.resendApiKey,
    mailFrom: config.mailFrom,
    mailTo: config.mailTo
  };
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}
