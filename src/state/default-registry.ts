import type { RegistryEntry } from "../core/contracts";

export function createDefaultRegistry(): RegistryEntry[] {
  return [
    {
      id: "role/coordinator",
      roleId: "coordinator",
      displayName: "Coordinator",
      bootstrapPath: "docs/agent-context/roles/coordinator.bootstrap.md",
      capabilities: ["run setup", "routing", "stop decisions"],
      allowedHandoffs: ["architect"]
    },
    {
      id: "role/architect",
      roleId: "architect",
      displayName: "Architect",
      bootstrapPath: "docs/agent-context/roles/architect.bootstrap.md",
      capabilities: ["decomposition", "execution planning", "acceptance criteria"],
      allowedHandoffs: ["implementer"]
    },
    {
      id: "role/implementer",
      roleId: "implementer",
      displayName: "Implementer",
      bootstrapPath: "docs/agent-context/roles/implementer.bootstrap.md",
      capabilities: ["task execution", "artifact delivery", "blocker reporting"],
      allowedHandoffs: ["reviewer"]
    },
    {
      id: "role/reviewer",
      roleId: "reviewer",
      displayName: "Reviewer",
      bootstrapPath: "docs/agent-context/roles/reviewer.bootstrap.md",
      capabilities: ["validation", "completion", "corrective feedback"],
      allowedHandoffs: ["implementer"]
    }
  ];
}

