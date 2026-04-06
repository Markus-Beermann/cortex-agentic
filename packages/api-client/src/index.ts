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
  acceptanceCriteria: string[];
  approvalMode: string;
  constraints: string[];
  createdAt: string;
  id: string;
  inputContext: string[];
  objective: string;
  projectId: string;
  requestedRole: string;
  runId: string;
  status: TaskStatus;
  title: string;
  updatedAt: string;
};

export type OutputArtifact = {
  kind: "note" | "file" | "decision";
  path?: string;
  content: string;
  note?: string;
};

export type Output = {
  artifacts: OutputArtifact[];
  blockers: string[];
  createdAt: string;
  decisions: string[];
  id: string;
  nextAction: { kind: string; targetRole?: string; taskTitle?: string };
  roleId: string;
  summary: string;
  taskId: string;
};

export type DeferredTaskStatus = "pending" | "released";

export type DeferredTask = {
  addressee: string;
  context: unknown;
  createdAt: string;
  createdBy: string;
  goal: string;
  id: string;
  releasedAt: string | null;
  status: DeferredTaskStatus;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  content: string;
  role: ChatRole;
};

export type LLMProviderOption = {
  displayName: string;
  id: string;
};

export type RepoOption = {
  fullName: string;
  id: string;
  name: string;
};

export type RegistryEntry = {
  aliases: string[];
  allowedHandoffs: string[];
  bootstrapPath: string;
  capabilities: string[];
  displayName: string;
  id: string;
  personaName: string;
  roleId: string;
  technicalName: string;
};

export type ChatRequest = {
  agentId: string;
  llmId: string;
  message: string;
  repoId?: string;
  sessionId: string;
};

export type ChatResponse = {
  messageId: number;
  reply: string;
};

export type CreateRunRequest = {
  goal: string;
  projectId?: string;
};

export type HealthResponse = {
  backend: string;
  ok: true;
};

export class CortexApiClientError extends Error {
  public readonly status: number;

  public constructor(message: string, status = 500) {
    super(message);
    this.name = "CortexApiClientError";
    this.status = status;
  }
}

export type CortexApiClientConfig = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => Promise<string | null | undefined>;
};

export interface CortexApiClient {
  cancelRun(runId: string): Promise<RunState>;
  createRun(input: CreateRunRequest): Promise<RunState>;
  health(): Promise<HealthResponse>;
  listDeferredTasks(addressee?: string, status?: DeferredTaskStatus): Promise<DeferredTask[]>;
  listLLMProviders(): Promise<LLMProviderOption[]>;
  listOutputs(runId: string): Promise<Output[]>;
  listRegistryEntries(): Promise<RegistryEntry[]>;
  listRepos(): Promise<RepoOption[]>;
  listRuns(): Promise<RunState[]>;
  listTasks(runId: string): Promise<Task[]>;
  readChatHistory(sessionId: string): Promise<ChatMessage[]>;
  readRunEvents(runId: string): Promise<RunEvent[]>;
  readRunState(runId: string): Promise<RunState>;
  releaseDeferredTask(id: string): Promise<DeferredTask>;
  sendChatMessage(input: ChatRequest): Promise<ChatResponse>;
}

type RequestOptions = {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

function resolveBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim();

  if (trimmedBaseUrl.length === 0) {
    throw new CortexApiClientError("NEXT_PUBLIC_RAILWAY_URL is not configured.", 500);
  }

  return trimmedBaseUrl.endsWith("/") ? trimmedBaseUrl : `${trimmedBaseUrl}/`;
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

function extractError(payload: unknown): string | null {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }

  if ("error" in payload && typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  return null;
}

function normalizeRepoOptions(payload: unknown): RepoOption[] {
  if (!Array.isArray(payload)) {
    throw new CortexApiClientError("Invalid repository payload.", 502);
  }

  return payload
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: String(entry.id ?? ""),
      name: typeof entry.name === "string" ? entry.name : "",
      fullName:
        typeof entry.fullName === "string"
          ? entry.fullName
          : typeof entry.full_name === "string"
            ? entry.full_name
            : ""
    }))
    .filter((entry) => entry.id.length > 0 && entry.name.length > 0 && entry.fullName.length > 0);
}

function castArray<T>(payload: unknown, label: string): T[] {
  if (!Array.isArray(payload)) {
    throw new CortexApiClientError(`Invalid ${label} payload.`, 502);
  }

  return payload as T[];
}

function castObject<T>(payload: unknown, label: string): T {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new CortexApiClientError(`Invalid ${label} payload.`, 502);
  }

  return payload as T;
}

export function createCortexApiClient(config: CortexApiClientConfig): CortexApiClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  async function requestJson(path: string, options?: RequestOptions): Promise<unknown> {
    const headers = new Headers({
      accept: "application/json"
    });

    if (options?.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    const accessToken = await config.getAccessToken?.();
    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const response = await fetchImpl(new URL(path.replace(/^\//u, ""), resolveBaseUrl(config.baseUrl)).toString(), {
      method: options?.method ?? "GET",
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });

    const payload = parseBody(await response.text());

    if (!response.ok) {
      throw new CortexApiClientError(
        extractError(payload) ?? response.statusText ?? `Request failed for ${path}`,
        response.status
      );
    }

    return payload;
  }

  return {
    async health() {
      return castObject<HealthResponse>(await requestJson("/health"), "health");
    },

    async listRuns() {
      return castArray<RunState>(await requestJson("/runs"), "runs");
    },

    async createRun(input) {
      return castObject<RunState>(await requestJson("/runs", { body: input, method: "POST" }), "run");
    },

    async readRunState(runId) {
      return castObject<RunState>(await requestJson(`/runs/${encodeURIComponent(runId)}/state`), "run");
    },

    async readRunEvents(runId) {
      return castArray<RunEvent>(await requestJson(`/runs/${encodeURIComponent(runId)}/events`), "events");
    },

    async listTasks(runId) {
      return castArray<Task>(await requestJson(`/runs/${encodeURIComponent(runId)}/tasks`), "tasks");
    },

    async listOutputs(runId) {
      return castArray<Output>(await requestJson(`/runs/${encodeURIComponent(runId)}/outputs`), "outputs");
    },

    async cancelRun(runId) {
      return castObject<RunState>(
        await requestJson(`/runs/${encodeURIComponent(runId)}/cancel`, { method: "PATCH" }),
        "run"
      );
    },

    async listDeferredTasks(addressee, status) {
      const searchParams = new URLSearchParams();
      if (addressee) {
        searchParams.set("addressee", addressee);
      }
      if (status) {
        searchParams.set("status", status);
      }

      const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
      return castArray<DeferredTask>(await requestJson(`/deferred-tasks${suffix}`), "deferred tasks");
    },

    async releaseDeferredTask(id) {
      return castObject<DeferredTask>(
        await requestJson(`/deferred-tasks/${encodeURIComponent(id)}/release`, { method: "PATCH" }),
        "deferred task"
      );
    },

    async readChatHistory(sessionId) {
      return castArray<ChatMessage>(
        await requestJson(`/chat/history?sessionId=${encodeURIComponent(sessionId)}`),
        "chat history"
      );
    },

    async sendChatMessage(input) {
      return castObject<ChatResponse>(await requestJson("/chat", { body: input, method: "POST" }), "chat reply");
    },

    async listLLMProviders() {
      return castArray<LLMProviderOption>(await requestJson("/llm-providers"), "llm providers");
    },

    async listRepos() {
      return normalizeRepoOptions(await requestJson("/repos"));
    },

    async listRegistryEntries() {
      return castArray<RegistryEntry>(await requestJson("/registry"), "registry");
    }
  };
}
