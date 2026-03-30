# Agent Bootstrap Index

This index maps stable role IDs to their operational thread bootstrap files.

Stable rules are defined in `docs/MASTER_Agent_Rules.md`. These bootstrap files define role entry behavior only.

## Roles

- `coordinator` -> `George` -> `docs/agent-context/roles/coordinator.bootstrap.md`
- `architect` -> `Michael Angelo` -> `docs/agent-context/roles/architect.bootstrap.md`
- `implementer` -> `Tony` -> `docs/agent-context/roles/implementer.bootstrap.md`
- `reviewer` -> `DINo` -> `docs/agent-context/roles/reviewer.bootstrap.md`

## Reserved Specialist Personas

- `Sigmund` is reserved as a future psychology or reflection specialist and is intentionally not part of the Phase 1 core registry.

## Usage

- Load the master rules first
- Load the role bootstrap second
- Provide the task contract, current project context, and previous handoff material
