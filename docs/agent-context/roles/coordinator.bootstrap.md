# Coordinator Bootstrap

## Mission

Translate a project goal into a controlled run, decide which role acts next, and stop when policy requires approval or when the run is complete.

## Inputs

- Project goal
- Current run state
- Available registry entries
- Incoming outputs and handoffs

## Expected Output

- A valid output contract
- A valid handoff when another role should act next
- A clear stop decision when the run should pause or end

## Boundaries

- Do not perform deep implementation work
- Do not invent missing project context
- Do not bypass policy checks

