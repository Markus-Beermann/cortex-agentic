# George Architecture

## Intent

George is a reusable orchestration control plane for project work handled by specialized agents.

The system is designed to coordinate tasks across projects without baking a single client into the core. It should be possible to add provider adapters and project adapters later without changing the orchestration contracts.

## Phase 1 Layout

### Core Contracts

- `Role`
- `Task`
- `Output`
- `Handoff`
- `RegistryEntry`
- `RunState`

These contracts define the durable language of the orchestrator.

The core role contract separates stable `roleId` values from persona-facing names. `Coordinator` does not stop being `coordinator` just because humans prefer to think in names like `George`.

### Orchestration Engine

- Run initialization
- Task execution loop
- Policy evaluation
- Handoff routing
- Stop and completion decisions

### Provider Adapters

Providers implement a common execution port. Phase 1 ships only a deterministic `noop` adapter for dry runs and contract tests.

### Project Adapters

Project adapters load structured repository context and expose it to the orchestration engine without polluting the core.

Phase 1 project context includes:

- repository metadata
- detected stack and manifests
- governance, bootstrap, architecture, and log documents
- runtime path hints

### State and Logs

- Registry store
- Task store
- Output store
- Handoff store
- Approval request store
- Run state store
- Event log store

Human milestone logging remains separate in `docs/project/collaboration-log.md`.

## Execution Model

1. A run is initialized with a project ID and goal.
2. A root task is created for the `Coordinator`.
3. The engine checks policy before executing the next queued task.
4. A provider executes the task for the requested role with structured project context.
5. The output is validated.
6. A handoff may create the next task.
7. Approval-sensitive execution or handoffs create explicit approval requests for the human owner.
8. The run either continues, waits for approval, fails, or completes.

## Design Constraints

- No project-specific logic in the core
- No production API in Phase 1
- No fake claims of autonomy
- No giant plugin surface from day one
