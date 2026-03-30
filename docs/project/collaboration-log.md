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
