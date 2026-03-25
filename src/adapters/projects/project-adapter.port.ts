import type { ProjectContext } from "../../core/contracts";

export interface ProjectAdapterPort {
  loadContext(projectId: string): Promise<ProjectContext>;
}
