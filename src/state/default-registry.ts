import type { RegistryEntry } from "../core/contracts";

export function createDefaultRegistry(): RegistryEntry[] {
  return [
    {
      id: "role/coordinator",
      roleId: "coordinator",
      technicalName: "Coordinator",
      personaName: "George",
      aliases: ["George Senior"],
      displayName: "George",
      bootstrapPath: "docs/agent-context/roles/coordinator.bootstrap.md",
      capabilities: ["run setup", "routing", "stop decisions"],
      allowedHandoffs: ["architect", "implementer", "reviewer"]
    },
    {
      id: "role/architect",
      roleId: "architect",
      technicalName: "Architect",
      personaName: "Michael Angelo",
      aliases: ["Michael"],
      displayName: "Michael Angelo",
      bootstrapPath: "docs/agent-context/roles/architect.bootstrap.md",
      capabilities: ["decomposition", "execution planning", "acceptance criteria"],
      allowedHandoffs: ["implementer"]
    },
    {
      id: "role/implementer",
      roleId: "implementer",
      technicalName: "Implementer",
      personaName: "Tony",
      aliases: ["Tony Stark"],
      displayName: "Tony",
      bootstrapPath: "docs/agent-context/roles/implementer.bootstrap.md",
      capabilities: ["task execution", "artifact delivery", "blocker reporting"],
      allowedHandoffs: ["reviewer"]
    },
    {
      id: "role/reviewer",
      roleId: "reviewer",
      technicalName: "Reviewer",
      personaName: "DINo",
      aliases: ["DINo Reviewer"],
      displayName: "DINo",
      bootstrapPath: "docs/agent-context/roles/reviewer.bootstrap.md",
      capabilities: ["validation", "completion", "corrective feedback"],
      allowedHandoffs: ["implementer"]
    }
  ];
}
