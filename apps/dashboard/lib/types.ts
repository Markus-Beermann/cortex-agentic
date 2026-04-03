export type RunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed";

export type RunState = {
  activeTaskId: string | null;
  completedTaskIds: string[];
  createdAt: string;
  goal: string;
  id: string;
  outputIds: string[];
  pendingApprovalIds: string[];
  projectId: string;
  queuedTaskIds: string[];
  status: RunStatus;
  updatedAt: string;
};

export type RunEvent = {
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
  runId: string;
  timestamp: string;
};

export type TaskStatus = "queued" | "in_progress" | "completed" | "failed";

export type Task = {
  id: string;
  runId: string;
  projectId: string;
  title: string;
  objective: string;
  requestedRole: string;
  constraints: string[];
  inputContext: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  approvalMode: string;
  createdAt: string;
  updatedAt: string;
};

export type OutputArtifact = {
  kind: "note" | "file" | "decision";
  path?: string;
  content: string;
  note?: string;
};

export type Output = {
  id: string;
  taskId: string;
  roleId: string;
  createdAt: string;
  summary: string;
  decisions: string[];
  blockers: string[];
  artifacts: OutputArtifact[];
  nextAction: { kind: string; targetRole?: string; taskTitle?: string };
};

export type DeferredTaskStatus = "pending" | "released";

export type DeferredTask = {
  id: string;
  addressee: string;
  goal: string;
  context: unknown;
  status: DeferredTaskStatus;
  createdAt: string;
  releasedAt: string | null;
  createdBy: string;
};
