# Agent Bootstrap Index

This index maps stable role IDs to their operational thread bootstrap files.

Stable rules are defined in `docs/MASTER_Agent_Rules.md`. These bootstrap files define role entry behavior only.

## Roles

- `coordinator` -> `docs/agent-context/roles/coordinator.bootstrap.md`
- `architect` -> `docs/agent-context/roles/architect.bootstrap.md`
- `implementer` -> `docs/agent-context/roles/implementer.bootstrap.md`
- `reviewer` -> `docs/agent-context/roles/reviewer.bootstrap.md`

## Usage

- Load the master rules first
- Load the role bootstrap second
- Provide the task contract, current project context, and previous handoff material

