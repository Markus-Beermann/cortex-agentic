import type { RunEvent, RunState } from "@/lib/types";

type RoleId = "coordinator" | "architect" | "implementer" | "reviewer";

const ROLES: Array<{ id: RoleId; label: string; persona: string }> = [
  { id: "coordinator", label: "Coordinator", persona: "George" },
  { id: "architect", label: "Architect", persona: "Michael Angelo" },
  { id: "implementer", label: "Implementer", persona: "Tony" },
  { id: "reviewer", label: "Reviewer", persona: "DINo" }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function deriveTaskRoleMap(events: RunEvent[]): Map<string, RoleId> {
  const roles = new Map<string, RoleId>();

  for (const event of events) {
    if (event.eventType !== "task.started" || !isRecord(event.payload)) {
      continue;
    }

    const taskId = readString(event.payload.taskId);
    const roleId = readString(event.payload.roleId);

    if (!taskId || !roleId || !ROLES.some((role) => role.id === roleId)) {
      continue;
    }

    roles.set(taskId, roleId as RoleId);
  }

  return roles;
}

function deriveCompletedHandoffs(run: RunState | null, events: RunEvent[]): number {
  const fromEvents = events.filter(
    (event) =>
      event.eventType === "handoff.created" &&
      isRecord(event.payload) &&
      ROLES.some((role) => role.id === readString(event.payload.toRole))
  ).length;

  if (fromEvents > 0) {
    return Math.min(3, fromEvents);
  }

  if (!run) {
    return 0;
  }

  return Math.min(3, Math.max(0, run.completedTaskIds.length - 1));
}

function deriveActiveRole(run: RunState | null, events: RunEvent[]): RoleId | null {
  const taskRoles = deriveTaskRoleMap(events);

  if (run?.activeTaskId && taskRoles.has(run.activeTaskId)) {
    return taskRoles.get(run.activeTaskId) ?? null;
  }

  if (events.length > 0) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];

      if (event.eventType !== "task.started" || !isRecord(event.payload)) {
        continue;
      }

      const roleId = readString(event.payload.roleId);

      if (roleId && ROLES.some((role) => role.id === roleId)) {
        return roleId as RoleId;
      }
    }
  }

  if (!run) {
    return null;
  }

  if (run.status === "completed" || run.status === "failed") {
    return "reviewer";
  }

  switch (run.completedTaskIds.length) {
    case 0:
      return "coordinator";
    case 1:
      return "architect";
    case 2:
      return "implementer";
    default:
      return "reviewer";
  }
}

function deriveActiveEdgeIndex(activeRole: RoleId | null): number | null {
  switch (activeRole) {
    case "architect":
      return 0;
    case "implementer":
      return 1;
    case "reviewer":
      return 2;
    default:
      return null;
  }
}

function nodeClass(roleId: RoleId, activeRole: RoleId | null, run: RunState | null): string {
  if (roleId === activeRole && run?.status !== "completed") {
    return "active";
  }

  if (run?.status === "completed") {
    return "complete";
  }

  return "stage";
}

export function buildRunGraph(run: RunState | null, events: RunEvent[]) {
  const activeRole = deriveActiveRole(run, events);
  const activeEdgeIndex = run?.status === "completed" ? null : deriveActiveEdgeIndex(activeRole);
  const completedHandoffs = deriveCompletedHandoffs(run, events);

  const definition = [
    "flowchart LR",
    ...ROLES.map(
      (role) => `    ${role.id}[\"${role.label}<br/><small>${role.persona}</small>\"]`
    ),
    "    coordinator --> architect",
    "    architect --> implementer",
    "    implementer --> reviewer",
    `    class coordinator ${nodeClass("coordinator", activeRole, run)}`,
    `    class architect ${nodeClass("architect", activeRole, run)}`,
    `    class implementer ${nodeClass("implementer", activeRole, run)}`,
    `    class reviewer ${nodeClass("reviewer", activeRole, run)}`,
    "    classDef stage fill:#10233a,stroke:#426587,color:#eff6ff,stroke-width:1.5px;",
    "    classDef active fill:#11335a,stroke:#57a4ff,color:#eff6ff,stroke-width:3px;",
    "    classDef complete fill:#102a23,stroke:#35d49a,color:#eff6ff,stroke-width:2px;",
    ...[0, 1, 2].map((index) => {
      if (activeEdgeIndex === index) {
        return `    linkStyle ${index} stroke:#57a4ff,stroke-width:4px;`;
      }

      if (completedHandoffs > index || run?.status === "completed") {
        return `    linkStyle ${index} stroke:#35d49a,stroke-width:3px;`;
      }

      return `    linkStyle ${index} stroke:#36506f,stroke-width:2px;`;
    })
  ].join("\n");

  const caption = activeEdgeIndex === null
    ? run?.status === "completed"
      ? "All handoffs completed."
      : "Static role chain. Active edge will light up once task and handoff events are available."
    : `Active connection: ${ROLES[activeEdgeIndex].label} → ${ROLES[activeEdgeIndex + 1].label}.`;

  return {
    caption,
    definition
  };
}
