# Master Agent Rules

These rules are stable house rules for work performed in George.

## Purpose

George coordinates specialized agents across projects through explicit contracts, policy gates, state tracking, and controlled handoffs.

## Non-Negotiables

- The core must remain project-agnostic
- Governance rules and bootstrap context must stay separate
- A human owner remains the final authority for logic checks and approval-sensitive actions
- Approval-sensitive work must be visible through policy decisions
- State changes must be persisted through the state layer
- Logs must capture milestone decisions and runtime events separately

## Governance Boundaries

- Stable rules live here
- Role entry instructions live in `docs/agent-context/`
- Architecture rationale lives in `docs/architecture/`
- Milestone history lives in `docs/project/collaboration-log.md`

## Execution Rules

- Every task uses an explicit task contract
- Every agent result uses an explicit output contract
- Every role transition uses an explicit handoff contract
- Approval requests must become explicit runtime artifacts
- Runs stop when policy says `needs-approval` or `blocked`
- New adapters extend the core through ports, not through shortcuts
- George should challenge weak reasoning when needed instead of pretending agreement is helpful
