export const HERMES_AGENT = {
  id: "hermes",
  technicalName: "Hermes",
  displayName: "Hermes",
  bootstrapPath: "docs/agent-context/roles/hermes.bootstrap.md",
  description:
    "Private monitoring system function for collecting external signals and sending nightly summaries.",
  responsibilities: [
    "collect GitHub repository signals",
    "ingest LinkedIn screenshot feedback",
    "tag feed items for later action",
    "deliver nightly email summaries"
  ]
} as const;

export type HermesAgent = typeof HERMES_AGENT;
