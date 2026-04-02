# Collaboration Log

Milestone-level log for collaboration decisions and meaningful repository progress.

## 2026-03-25

- Bootstrapped the private George repository structure.
- Separated stable governance documents from role-specific bootstrap context.
- Chose a TypeScript core with a deterministic `noop` provider for the first execution slice.
- Kept runtime state in `.orchestrator/` and human collaboration history in this file.
- Implemented Phase 1 contracts, state stores, orchestration loop, and CLI entry points.
- Verified the bootstrap with `npm run check` and a completed `npm run dry-run`.
- Added explicit approval-request state and human approval/resume CLI flow.
- Expanded the project adapter to expose structured repository context to providers and the orchestration engine.
- Added a persona alias layer so humans can think in names while the core keeps stable technical role IDs.
- Added registry inspection commands and git-aware project focus signals for future planning agents.
- Added run/event inspection commands, role-specific context selection, and a provider adapter v1 envelope.
- Added `run:list -- --status=waiting_approval` so human intervention points are visible without scanning every run.
- Added a bootstrap-aware prompt builder and a real Anthropic provider adapter behind the v1 provider port.
- Replaced free-form Anthropic JSON parsing with Zod-derived tool schemas so structured output is contract-led instead of luck-led.
- Added a bounded Anthropic self-correction retry when the first tool payload misses required contract fields.
- Split Anthropic recovery into a targeted `nextAction` repair path instead of rerolling the full output draft.
- Normalized PostgreSQL `run_events.timestamp` values before contract validation so Railway event reads no longer fail on `Date` serialization.

## 2026-04-01

- Renamed repository from `George` to `cortex-agentic` — system identity now reflects the full multi-agent scope.
- Added Express State-Server (`src/server/`) with PostgreSQL dual-write: runs and events persist to both `.orchestrator/` and Railway PostgreSQL simultaneously.
- Deployed State-Server to Railway with PostgreSQL plugin; confirmed remote API returns live run data.
- Added `apps/dashboard/` — standalone Next.js frontend built by Tony with run list, run detail, Mermaid handoff graph, and events timeline.
- Deployed dashboard to Vercel; live at `cortex-agentic-git-main-markus-beermanns-projects.vercel.app`.
- Added agent thread bootstrap prompts for Tony and Sigmund under `docs/agent-context/`.
- First milestone where Markus can see live orchestration runs in a browser without terminal access.

## 2026-04-02

- Fixed Phase 7 engine gap where `kind: "file"` artifacts existed only in output JSON; implementer file artifacts are now materialized into the selected project root.
- Scoped `projectId` to real workspace subdirectories such as `sandbox/` instead of treating it as a label with delusions of grandeur.
- Opened coordinator routing so trivial work can skip architecture and/or review instead of forcing every run through all four roles.
- Updated noop-provider heuristics and engine tests so a simple article request can complete in `sandbox/` with a real Markdown file on disk.
- Aligned server, dashboard, and poll defaults around `sandbox` for disposable engine testing.
- Added an explicit execution profile to provider requests so routing decisions are described as first-class context instead of living only inside provider heuristics.
- Persisted the coordinator routing profile as a dedicated run event so the dashboard can show why a run went direct-to-implementer or through the full pipeline.
- Surfaced the latest coordinator routing profile directly in the run detail overview so operators do not have to dig through the timeline for the decision summary.
