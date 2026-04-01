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
