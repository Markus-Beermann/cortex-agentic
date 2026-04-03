# Agent Bootstrap Index

This index maps stable role IDs to their operational thread bootstrap files.

Stable rules are defined in `docs/MASTER_Agent_Rules.md`. These bootstrap files define role entry behavior only.

## Roles

- `coordinator` -> `Claude Debussy` -> `docs/agent-context/roles/coordinator.bootstrap.md`
- `architect` -> `Michael Angelo` -> `docs/agent-context/roles/architect.bootstrap.md`
- `implementer` -> `Tony` -> `docs/agent-context/roles/implementer.bootstrap.md`
- `reviewer` -> `DINo` -> `docs/agent-context/roles/reviewer.bootstrap.md`

## System Roles

- `George Orwell` is a registered implementation-focused system role for direct code and artifact delivery.
- `George Orwell` bootstrap: `docs/agent-context/roles/george.bootstrap.md`
- `Sigmund` is a registered system role for psychology, ethics, reflection, and critique.
- `Sigmund` bootstrap: `docs/agent-context/roles/sigmund.bootstrap.md`
- `Hermes` is a private monitoring system function registered for discoverability, but intentionally outside the orchestration handoff graph.
- `Hermes` bootstrap: `docs/agent-context/roles/hermes.bootstrap.md`

## Usage

- Load the master rules first
- Load the role bootstrap second
- Provide the task contract, current project context, and previous handoff material
