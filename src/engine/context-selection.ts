import type { ContextSelection, ProjectContext, RoleId } from "../core/contracts";

export function selectContextForRole(
  roleId: RoleId,
  projectContext: ProjectContext
): ContextSelection {
  switch (roleId) {
    case "coordinator":
    case "architect":
      return projectContext.contexts.planningContext;
    case "implementer":
      return projectContext.contexts.implementationContext;
    case "reviewer":
      return projectContext.contexts.reviewContext;
  }
}

