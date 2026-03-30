import { randomUUID } from "node:crypto";

import type {
  ProjectContext,
  ProviderRequest,
  RegistryEntry,
  Task
} from "../core/contracts";
import { validateProviderRequest } from "../core/contracts";
import { nowIso } from "../state/file-store";
import { selectContextForRole } from "./context-selection";

export function buildProviderRequest(input: {
  providerId: string;
  projectContext: ProjectContext;
  role: RegistryEntry;
  task: Task;
}): ProviderRequest {
  const { providerId, projectContext, role, task } = input;

  return validateProviderRequest({
    id: randomUUID(),
    providerId,
    runId: task.runId,
    taskId: task.id,
    roleId: role.roleId,
    technicalName: role.technicalName,
    personaName: role.personaName,
    projectContext,
    selectedContext: selectContextForRole(role.roleId, projectContext),
    task,
    createdAt: nowIso()
  });
}

