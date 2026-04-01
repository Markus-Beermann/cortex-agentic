import type { RunEvent, RunState, RunStatus } from "@/lib/types";

class StateServerError extends Error {
  public readonly status: number;

  public constructor(message: string, status = 500) {
    super(message);
    this.name = "StateServerError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new StateServerError(`Invalid ${fieldName} field from state server.`, 502);
  }

  return value;
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new StateServerError(`Invalid ${fieldName} field from state server.`, 502);
  }

  return value;
}

function normalizeTimestamp(value: unknown, fieldName: string): string {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    throw new StateServerError(`Invalid ${fieldName} field from state server.`, 502);
  }

  const timestamp = new Date(value).toISOString();

  if (timestamp === "Invalid Date") {
    throw new StateServerError(`Invalid ${fieldName} field from state server.`, 502);
  }

  return timestamp;
}

function readNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, fieldName);
}

function readRunStatus(value: unknown): RunStatus {
  const status = readString(value, "status");

  if (
    status !== "pending" &&
    status !== "running" &&
    status !== "waiting_approval" &&
    status !== "completed" &&
    status !== "failed"
  ) {
    throw new StateServerError("Invalid status field from state server.", 502);
  }

  return status;
}

function parseBody(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getStateServerUrl(path: string): string {
  const baseUrl = process.env.ORCHESTRATOR_API_URL;

  if (!baseUrl) {
    throw new StateServerError("ORCHESTRATOR_API_URL is not configured.", 500);
  }

  return new URL(path.replace(/^\//u, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function extractResponseError(payload: unknown): string | null {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (isRecord(payload) && typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  return null;
}

async function requestJson(path: string): Promise<unknown> {
  const response = await fetch(getStateServerUrl(path), {
    cache: "no-store",
    headers: {
      accept: "application/json"
    },
    signal: AbortSignal.timeout(8_000)
  });

  const payload = parseBody(await response.text());

  if (!response.ok) {
    throw new StateServerError(
      extractResponseError(payload) ?? `State server request failed for ${path}.`,
      response.status
    );
  }

  return payload;
}

function normalizeRunState(value: unknown): RunState {
  if (!isRecord(value)) {
    throw new StateServerError("State server returned an invalid run payload.", 502);
  }

  return {
    activeTaskId: readNullableString(value.activeTaskId, "activeTaskId"),
    completedTaskIds: readStringArray(value.completedTaskIds, "completedTaskIds"),
    createdAt: normalizeTimestamp(value.createdAt, "createdAt"),
    goal: readString(value.goal, "goal"),
    id: readString(value.id, "id"),
    outputIds: readStringArray(value.outputIds, "outputIds"),
    pendingApprovalIds: readStringArray(value.pendingApprovalIds, "pendingApprovalIds"),
    projectId: readString(value.projectId, "projectId"),
    queuedTaskIds: readStringArray(value.queuedTaskIds, "queuedTaskIds"),
    status: readRunStatus(value.status),
    updatedAt: normalizeTimestamp(value.updatedAt, "updatedAt")
  };
}

function normalizeRunEvent(value: unknown): RunEvent {
  if (!isRecord(value)) {
    throw new StateServerError("State server returned an invalid event payload.", 502);
  }

  return {
    eventType: readString(value.eventType, "eventType"),
    id: readString(value.id, "id"),
    payload: isRecord(value.payload) ? value.payload : {},
    runId: readString(value.runId, "runId"),
    timestamp: normalizeTimestamp(value.timestamp, "timestamp")
  };
}

export function getResponseError(error: unknown): { message: string; status: number } {
  if (error instanceof StateServerError) {
    return {
      message: error.message,
      status: error.status
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
    status: 500
  };
}

export async function listRuns(): Promise<RunState[]> {
  const payload = await requestJson("/runs");

  if (!Array.isArray(payload)) {
    throw new StateServerError("State server returned an invalid runs payload.", 502);
  }

  return payload.map(normalizeRunState);
}

export async function readRunState(runId: string): Promise<RunState> {
  return normalizeRunState(await requestJson(`/runs/${runId}/state`));
}

export async function readRunEvents(runId: string): Promise<RunEvent[]> {
  const payload = await requestJson(`/runs/${runId}/events`);

  if (!Array.isArray(payload)) {
    throw new StateServerError("State server returned an invalid events payload.", 502);
  }

  return payload.map(normalizeRunEvent);
}
