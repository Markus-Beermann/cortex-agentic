# George

George is a reusable orchestration core for coordinating specialized agents across private software projects.

It is not a product demo, not a YCSP feature branch, and not a fake-autonomy circus. The core exists to route work safely: define roles, validate contracts, manage handoffs, persist state, and run a reusable orchestration loop that can be adapted to different projects later.

George keeps a human owner in the loop. The human defines intent, reviews logic, grants approvals, and is allowed to disagree with the machine. Shocking, apparently.

## Who It Is For

- Teams building private agent-assisted engineering workflows across multiple repositories
- Engineers who need repeatable agent bootstraps, explicit task contracts, and controlled handoffs
- Projects that want a semi-automatic orchestration core before adding provider adapters or public APIs

## Phase 1 Scope

George currently provides:

- A role registry with stable technical roles and human-friendly personas:
  - `Coordinator` -> `George`
  - `Architect` -> `Michael Angelo`
  - `Implementer` -> `Tony`
  - `Reviewer` -> `DINo`
- Typed contracts for tasks, outputs, handoffs, registry entries, and run state
- A file-backed state layer for registry, tasks, outputs, handoffs, run state, and event logs
- A structured project context model for repository docs, stack detection, git metadata, and focused changed-file signals
- A reusable orchestration loop with policy gates
- A `noop` provider for deterministic dry runs
- Pending approval requests with explicit approve, reject, and resume commands
- Governance rules kept separate from role-specific bootstraps

George does not yet provide:

- A production API layer
- Provider-specific adapters for OpenAI, Anthropic, Gemini, or others
- Project-specific logic in the core
- Claims of full autonomous operation because that would be embarrassing

## Quick Start

```bash
npm install
npm run bootstrap
npm run registry:list
npm run dry-run
npm run approvals:list
npm run check
```

`npm run bootstrap` seeds the local runtime registry in `.orchestrator/`.

`npm run registry:list` shows the registered agents with technical role IDs and human personas.

`npm run registry:inspect -- George` resolves a specific agent by role ID, technical name, persona name, or alias.

`npm run dry-run` executes a deterministic orchestration pass using the built-in `noop` provider and writes run artifacts into `.orchestrator/`.

`npm run dry-run -- --root-approval` forces a human approval gate before the first task executes.

`npm run dry-run -- --handoff-approval=coordinator` forces a human approval gate on the first handoff.

`npm run approvals:list` shows pending approval requests.

`npm run approve -- <approval-id>` approves a pending request and resumes the related run.

`npm run reject -- <approval-id>` rejects a pending request and marks the related run as failed.

## Repository Structure

```text
docs/
  MASTER_Agent_Rules.md
  architecture/
  agent-context/
  project/
src/
  core/
  engine/
  adapters/
  state/
  cli/
tests/
```

## Design Rules

- Keep the core project-agnostic
- Keep governance rules separate from operational bootstraps
- Keep a human owner in the decision loop for approval-sensitive work
- Keep technical role IDs stable and treat persona names as a separate alias layer
- Start with semi-automatic orchestration, not mythology
- Add providers and project adapters without changing core contracts
