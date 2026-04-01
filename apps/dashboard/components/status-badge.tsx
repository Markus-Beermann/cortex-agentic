import type { RunStatus } from "@/lib/types";

const STATUS_LABELS: Record<RunStatus, string> = {
  pending: "pending",
  running: "running",
  waiting_approval: "approval",
  completed: "completed",
  failed: "failed"
};

type StatusBadgeProps = {
  status: RunStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}
