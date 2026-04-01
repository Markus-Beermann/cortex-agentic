import type { RunEvent, RunStatus } from "@/lib/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short"
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roleLabel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "Unknown role";
  }

  return titleCase(value);
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatShortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.valueOf())) {
    return timestamp;
  }

  return DATE_FORMATTER.format(date);
}

export function formatRefreshTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.valueOf())) {
    return "just now";
  }

  return TIME_FORMATTER.format(date);
}

export function formatCount(value: number, label: string): string {
  return `${value} ${value === 1 ? label : `${label}s`}`;
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed";
}

export function getEventTone(event: RunEvent): "success" | "warning" | "danger" | "running" {
  if (event.eventType.includes("failed") || event.eventType.includes("rejected")) {
    return "danger";
  }

  if (event.eventType.includes("completed")) {
    return "success";
  }

  if (event.eventType.includes("approval") || event.eventType.includes("waiting")) {
    return "warning";
  }

  return "running";
}

export function formatEventLabel(event: RunEvent): string {
  const { payload } = event;

  switch (event.eventType) {
    case "run.initialized":
      return "Run initialized";
    case "task.started":
      return `${roleLabel(payload.roleId)} task started`;
    case "task.completed":
      return "Task completed";
    case "provider.executed":
      return `${titleCase(readString(payload, "providerId") ?? "provider")} executed`;
    case "handoff.created":
      return `Handoff to ${roleLabel(payload.toRole)}`;
    case "run.completed":
      return "Run completed";
    default:
      return titleCase(event.eventType.replace(/\./gu, " "));
  }
}

export function formatEventDetails(event: RunEvent): string {
  const { payload } = event;

  switch (event.eventType) {
    case "run.initialized":
      return readString(payload, "goal") ?? "Goal was captured for execution.";
    case "task.started":
      return `Task ${formatShortId(readString(payload, "taskId") ?? event.id)} started for ${roleLabel(
        payload.roleId
      )}.`;
    case "task.completed":
      return `Task ${formatShortId(readString(payload, "taskId") ?? event.id)} completed${
        readString(payload, "outputId")
          ? ` with output ${formatShortId(readString(payload, "outputId") ?? "")}.`
          : "."
      }`;
    case "provider.executed":
      return [
        readString(payload, "providerId"),
        readString(payload, "model"),
        readString(payload, "contextPurpose")
      ]
        .filter(Boolean)
        .join(" · ");
    case "handoff.created":
      return `Next role ${roleLabel(payload.toRole)}${
        readString(payload, "nextTaskId")
          ? ` on task ${formatShortId(readString(payload, "nextTaskId") ?? "")}.`
          : "."
      }`;
    case "run.completed":
      return `${readNumber(payload, "completedTaskCount") ?? 0} tasks completed in total.`;
    default:
      return JSON.stringify(payload);
  }
}
