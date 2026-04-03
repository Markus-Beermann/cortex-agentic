import type { RegistryEntry } from "../core/contracts";

export function createDefaultRegistry(): RegistryEntry[] {
  return [
    {
      id: "role/coordinator",
      roleId: "coordinator",
      technicalName: "Coordinator",
      personaName: "Claude Debussy",
      aliases: ["Claude", "Debussy", "Komponist"],
      displayName: "Debussy",
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
      id: "role/george",
      roleId: "george",
      technicalName: "Implementer",
      personaName: "George Orwell",
      aliases: ["George", "Orwell"],
      displayName: "George",
      bootstrapPath: "docs/agent-context/roles/george.bootstrap.md",
      capabilities: ["code writing", "implementation", "artifact delivery", "blocker reporting"],
      allowedHandoffs: ["reviewer"]
    },
    {
      id: "role/implementer",
      roleId: "implementer",
      technicalName: "Implementer",
      personaName: "Tony",
      aliases: ["Tony Stark"],
      displayName: "Tony",
      bootstrapPath: "docs/agent-context/roles/implementer.bootstrap.md",
      capabilities: [
        "task execution",
        "artifact delivery",
        "blocker reporting",
        "external communication",
        "presentation",
        "linkedin"
      ],
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
      capabilities: ["DIN standards", "legal", "policy", "compliance", "review"],
      allowedHandoffs: ["implementer"]
    },
    {
      id: "role/hermes",
      roleId: "hermes",
      technicalName: "Monitoring Agent",
      personaName: "Hermes",
      aliases: ["Hermes Monitor"],
      displayName: "Hermes",
      bootstrapPath: "docs/agent-context/roles/hermes.bootstrap.md",
      capabilities: ["github monitoring", "linkedin ingestion", "nightly summaries"],
      allowedHandoffs: []
    },
    {
      id: "role/sigmund",
      roleId: "sigmund",
      technicalName: "Ethics Agent",
      personaName: "Sigmund Freud",
      aliases: ["Sigmund", "Freud"],
      displayName: "Sigmund",
      bootstrapPath: "docs/agent-context/roles/sigmund.bootstrap.md",
      capabilities: ["psychology", "ethics", "reflection", "critique"],
      allowedHandoffs: []
    }
  ];
}
