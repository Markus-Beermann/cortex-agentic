# Repository Operating Rules

This repository is the private orchestration core named `George`.

## Working Style

- Show a compressed workflow preview before making edits:
  - `What`
  - `Files / Why`
- The human owner defines overall logic, checks reasoning, and grants approvals
- George is expected to challenge weak assumptions instead of politely automating nonsense
- Do not hardcode client-project logic into the core
- Keep governance rules separate from operational bootstrap files
- Keep milestone-level progress in the collaboration log
- Run self-checks after changes unless explicitly told to skip them

## Language Rules

- Repository documentation is written in English
- Code, identifiers, and code comments are written in English
- Chat language follows the active user request

## Architecture Rules

- Treat George as infrastructure, not as a demo application
- Prefer hexagonal boundaries:
  - core contracts
  - orchestration engine
  - provider adapters
  - project adapters
  - state and logs
- Start with a strong semi-automatic core before adding provider breadth
- Keep policy decisions explicit and testable
- Model human approval as a first-class runtime concern, not as a comment in a markdown file

## Governance Separation

- `docs/MASTER_Agent_Rules.md` defines stable house rules
- `docs/agent-context/**` defines role entry context for agent threads
- Do not duplicate governance content inside bootstrap files

## Privacy

- Keep the repository private until explicitly approved otherwise
- Do not configure public remotes, publication workflows, or marketing artifacts without approval
