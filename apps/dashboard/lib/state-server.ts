import type {
  ChatMessage,
  DeferredTask,
  DeferredTaskStatus,
  LLMProviderOption,
  Output,
  RegistryEntry,
  RepoOption,
  OutputArtifact,
  RunEvent,
  RunState,
  RunStatus,
  Task,
  TaskStatus
} from "@/lib/types";

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

function readDeferredTaskStatus(value: unknown): DeferredTaskStatus {
  const status = readString(value, "status");

  if (status !== "pending" && status !== "released") {
    throw new StateServerError("Invalid deferred task status field from state server.", 502);
  }

  return status;
}

function readChatRole(value: unknown): ChatMessage["role"] {
  const role = readString(value, "role");

  if (role !== "user" && role !== "assistant") {
    throw new StateServerError("Invalid chat role field from state server.", 502);
  }

  return role;
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

async function requestJson(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
  const response = await fetch(getStateServerUrl(path), {
    method: options?.method ?? "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(options?.body !== undefined ? { "content-type": "application/json" } : {})
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
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

function readTaskStatus(value: unknown): TaskStatus {
  const s = readString(value, "status");
  if (s !== "queued" && s !== "in_progress" && s !== "completed" && s !== "failed") {
    throw new StateServerError("Invalid task status.", 502);
  }
  return s;
}

function normalizeTask(value: unknown): Task {
  if (!isRecord(value)) throw new StateServerError("Invalid task payload.", 502);
  return {
    id: readString(value.id, "id"),
    runId: readString(value.runId, "runId"),
    projectId: readString(value.projectId, "projectId"),
    title: readString(value.title, "title"),
    objective: readString(value.objective, "objective"),
    requestedRole: readString(value.requestedRole, "requestedRole"),
    constraints: readStringArray(value.constraints, "constraints"),
    inputContext: readStringArray(value.inputContext, "inputContext"),
    acceptanceCriteria: readStringArray(value.acceptanceCriteria, "acceptanceCriteria"),
    status: readTaskStatus(value.status),
    approvalMode: readString(value.approvalMode, "approvalMode"),
    createdAt: normalizeTimestamp(value.createdAt, "createdAt"),
    updatedAt: normalizeTimestamp(value.updatedAt, "updatedAt")
  };
}

function normalizeArtifact(value: unknown): OutputArtifact {
  if (!isRecord(value)) throw new StateServerError("Invalid artifact.", 502);
  const kind = readString(value.kind, "kind");
  if (kind !== "note" && kind !== "file" && kind !== "decision") {
    throw new StateServerError("Invalid artifact kind.", 502);
  }
  return {
    kind,
    path: typeof value.path === "string" ? value.path : undefined,
    content: readString(value.content, "content"),
    note: typeof value.note === "string" ? value.note : undefined
  };
}

function normalizeOutput(value: unknown): Output {
  if (!isRecord(value)) throw new StateServerError("Invalid output payload.", 502);
  const nextAction = isRecord(value.nextAction) ? value.nextAction : {};
  return {
    id: readString(value.id, "id"),
    taskId: readString(value.taskId, "taskId"),
    roleId: readString(value.roleId, "roleId"),
    createdAt: normalizeTimestamp(value.createdAt, "createdAt"),
    summary: readString(value.summary, "summary"),
    decisions: readStringArray(value.decisions, "decisions"),
    blockers: readStringArray(value.blockers, "blockers"),
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact) : [],
    nextAction: {
      kind: typeof nextAction.kind === "string" ? nextAction.kind : "complete",
      targetRole: typeof nextAction.targetRole === "string" ? nextAction.targetRole : undefined,
      taskTitle: typeof nextAction.taskTitle === "string" ? nextAction.taskTitle : undefined
    }
  };
}

function normalizeDeferredTask(value: unknown): DeferredTask {
  if (!isRecord(value)) {
    throw new StateServerError("Invalid deferred task payload.", 502);
  }

  return {
    id: readString(value.id, "id"),
    addressee: readString(value.addressee, "addressee"),
    goal: readString(value.goal, "goal"),
    context: value.context ?? null,
    status: readDeferredTaskStatus(value.status),
    createdAt: normalizeTimestamp(value.createdAt, "createdAt"),
    releasedAt: readNullableString(value.releasedAt, "releasedAt"),
    createdBy: readString(value.createdBy, "createdBy")
  };
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new StateServerError(`Invalid ${fieldName} field from state server.`, 502);
  }

  return value;
}

function normalizeChatMessage(value: unknown): ChatMessage {
  if (!isRecord(value)) {
    throw new StateServerError("Invalid chat message payload.", 502);
  }

  return {
    role: readChatRole(value.role),
    content: readString(value.content, "content")
  };
}

function normalizeLLMProviderOption(value: unknown): LLMProviderOption {
  if (!isRecord(value)) {
    throw new StateServerError("Invalid LLM provider payload.", 502);
  }

  return {
    id: readString(value.id, "id"),
    displayName: readString(value.displayName, "displayName")
  };
}

function normalizeRepoOption(value: unknown): RepoOption {
  if (!isRecord(value)) {
    throw new StateServerError("Invalid repository payload.", 502);
  }

  return {
    id: readString(value.id, "id"),
    name: readString(value.name, "name"),
    fullName: readString(value.full_name, "full_name")
  };
}

function normalizeRegistryEntry(value: unknown): RegistryEntry {
  if (!isRecord(value)) {
    throw new StateServerError("Invalid registry entry payload.", 502);
  }

  return {
    id: readString(value.id, "id"),
    roleId: readString(value.roleId, "roleId"),
    technicalName: readString(value.technicalName, "technicalName"),
    personaName: readString(value.personaName, "personaName"),
    aliases: Array.isArray(value.aliases)
      ? readStringArray(value.aliases, "aliases")
      : [],
    displayName: readString(value.displayName, "displayName"),
    bootstrapPath: readString(value.bootstrapPath, "bootstrapPath"),
    capabilities: Array.isArray(value.capabilities)
      ? readStringArray(value.capabilities, "capabilities")
      : [],
    allowedHandoffs: Array.isArray(value.allowedHandoffs)
      ? readStringArray(value.allowedHandoffs, "allowedHandoffs")
      : []
  };
}

export async function listTasks(runId: string): Promise<Task[]> {
  const payload = await requestJson(`/runs/${runId}/tasks`);
  if (!Array.isArray(payload)) throw new StateServerError("Invalid tasks payload.", 502);
  return payload.map(normalizeTask);
}

export async function listOutputs(runId: string): Promise<Output[]> {
  const payload = await requestJson(`/runs/${runId}/outputs`);
  if (!Array.isArray(payload)) throw new StateServerError("Invalid outputs payload.", 502);
  return payload.map(normalizeOutput);
}

export async function cancelRun(runId: string): Promise<RunState> {
  return normalizeRunState(
    await requestJson(`/runs/${runId}/cancel`, { method: "PATCH" })
  );
}

export async function createRun(goal: string, projectId = "sandbox"): Promise<RunState> {
  return normalizeRunState(
    await requestJson("/runs", { method: "POST", body: { goal, projectId } })
  );
}

export async function listDeferredTasks(
  addressee?: string,
  status?: DeferredTaskStatus
): Promise<DeferredTask[]> {
  const searchParams = new URLSearchParams();

  if (addressee) {
    searchParams.set("addressee", addressee);
  }

  if (status) {
    searchParams.set("status", status);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const payload = await requestJson(`/deferred-tasks${suffix}`);

  if (!Array.isArray(payload)) {
    throw new StateServerError("Invalid deferred tasks payload.", 502);
  }

  return payload.map(normalizeDeferredTask);
}

export async function releaseDeferredTask(id: string): Promise<DeferredTask> {
  return normalizeDeferredTask(
    await requestJson(`/deferred-tasks/${id}/release`, { method: "PATCH" })
  );
}

export async function readChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const payload = await requestJson(`/chat/history?sessionId=${encodeURIComponent(sessionId)}`);

  if (!Array.isArray(payload)) {
    throw new StateServerError("Invalid chat history payload.", 502);
  }

  return payload.map(normalizeChatMessage);
}

export async function sendChatMessage(input: {
  message: string;
  agentId: string;
  repoId?: string;
  llmId: string;
  sessionId: string;
}): Promise<{ reply: string; messageId: number }> {
  const payload = await requestJson("/chat", {
    method: "POST",
    body: input
  });

  if (!isRecord(payload)) {
    throw new StateServerError("Invalid chat response payload.", 502);
  }

  return {
    reply: readString(payload.reply, "reply"),
    messageId: readNumber(payload.messageId, "messageId")
  };
}

export async function listLLMProviderOptions(): Promise<LLMProviderOption[]> {
  const payload = await requestJson("/llm-providers");

  if (!Array.isArray(payload)) {
    throw new StateServerError("Invalid llm providers payload.", 502);
  }

  return payload.map(normalizeLLMProviderOption);
}

export async function listRepos(): Promise<RepoOption[]> {
  const payload = await requestJson("/repos");

  if (!Array.isArray(payload)) {
    throw new StateServerError("Invalid repositories payload.", 502);
  }

  return payload.map(normalizeRepoOption);
}

export async function listRegistryEntries(): Promise<RegistryEntry[]> {
  const payload = await requestJson("/registry");

  if (!Array.isArray(payload)) {
    throw new StateServerError("Invalid registry payload.", 502);
  }

  return payload.map(normalizeRegistryEntry);
}
