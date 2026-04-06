import { readFile } from "node:fs/promises";
import path from "node:path";

import express from "express";

import type { RegistryEntry } from "../core/contracts";
import { DeferredTaskStatusSchema } from "../core/contracts";
import { createHermesRuntime } from "../hermes/runtime";
import { getLLMProvider, listLLMProviders } from "../llm/llm-registry";
import { createDefaultRegistry } from "../state/default-registry";
import { EventLogStore } from "../state/event-log.store";
import { OutputStore } from "../state/output.store";
import { RegistryStore } from "../state/registry.store";
import { RunStateStore } from "../state/run-state.store";
import { TaskStore } from "../state/task.store";
import { createClerkJwtMiddleware, createRequireAuth } from "./auth";
import { getPool } from "./db";
import {
  pgCancelRun,
  pgCreatePendingRun,
  pgGetChatHistory,
  pgGetLLMAssignment,
  pgGetRunState,
  pgListArchitectureSnapshots,
  pgListDeferredTasks,
  pgListFeedItems,
  pgListEvents,
  pgListOutputs,
  pgListRuns,
  pgListTasks,
  pgReleaseDeferredTask,
  pgSaveArchitectureSnapshot,
  pgSaveChatMessage,
  pgSaveDeferredTask,
  pgSetLLMAssignment
} from "./pg-queries";

const ROOT_PATH = process.env.ORCHESTRATOR_ROOT ?? process.cwd();
const DATABASE_PUBLIC_URL = process.env.DATABASE_PUBLIC_URL;
const useDb = Boolean(DATABASE_PUBLIC_URL);

if (!useDb) {
  console.warn("[server] WARNING: DATABASE_PUBLIC_URL not set, using filesystem fallback");
}

const runStore = new RunStateStore(ROOT_PATH);
const eventStore = new EventLogStore(ROOT_PATH);
const registryStore = new RegistryStore(ROOT_PATH);
const bootstrapCache = new Map<string, string>();
let registrySeedPromise: Promise<RegistryEntry[]> | null = null;

export const app = express();

app.use(createClerkJwtMiddleware());
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.header("origin");

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Hermes-Secret");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    backend: useDb ? "postgres" : "filesystem"
  });
});

app.use(createRequireAuth());

app.get("/registry", async (_req, res) => {
  try {
    const entries = await listRegistryEntries();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/llm-providers", (_req, res) => {
  res.json(listLLMProviders());
});

app.get("/repos", async (_req, res) => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      res.status(503).json({ error: "GITHUB_TOKEN is not configured" });
      return;
    }

    const response = await fetch(
      "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100",
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${githubToken}`,
          "user-agent": "cortex-agentic-chat",
          "x-github-api-version": "2022-11-28"
        }
      }
    );

    const payload = await response.json() as unknown;

    if (!response.ok) {
      res.status(response.status).json({
        error: extractGithubError(payload) ?? "GitHub repository request failed"
      });
      return;
    }

    if (!Array.isArray(payload)) {
      res.status(502).json({ error: "GitHub returned an invalid repository payload" });
      return;
    }

    const repositories = payload
      .filter(isRecord)
      .map((repo) => ({
        id: String(repo.id ?? ""),
        name: typeof repo.name === "string" ? repo.name : "",
        full_name: typeof repo.full_name === "string" ? repo.full_name : ""
      }))
      .filter((repo) => repo.id.length > 0 && repo.name.length > 0 && repo.full_name.length > 0);

    res.json(repositories);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/chat/history", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Chat history requires database backend" });
      return;
    }

    const sessionId = getRequiredString(req.query.sessionId, "sessionId");

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const history = await pgGetChatHistory(getPool(), sessionId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/chat", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Chat requires database backend" });
      return;
    }

    const body = req.body as {
      message?: unknown;
      agentId?: unknown;
      repoId?: unknown;
      llmId?: unknown;
      sessionId?: unknown;
    };

    const message = getRequiredString(body.message, "message");
    const agentId = getRequiredString(body.agentId, "agentId");
    const llmId = getRequiredString(body.llmId, "llmId");
    const sessionId = getRequiredString(body.sessionId, "sessionId");
    const repoId = getOptionalString(body.repoId);

    if (!message || !agentId || !llmId || !sessionId) {
      res.status(400).json({ error: "message, agentId, llmId, and sessionId are required" });
      return;
    }

    const registryEntry = await resolveRegistryEntry(agentId);

    if (!registryEntry) {
      res.status(404).json({ error: `Unknown agentId: ${agentId}` });
      return;
    }

    let provider: ReturnType<typeof getLLMProvider>;
    try {
      provider = getLLMProvider(llmId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unknown LLM provider" });
      return;
    }

    const bootstrapPrompt = await readBootstrapPrompt(registryEntry.bootstrapPath);
    const currentAssignment = await pgGetLLMAssignment(getPool(), agentId);
    const history = await pgGetChatHistory(getPool(), sessionId);
    const systemPrompt = [
      bootstrapPrompt,
      `Du arbeitest gerade an Repo: ${repoId ?? "unspecified"}`,
      `Aktiver Agent: ${registryEntry.displayName} (${registryEntry.id})`,
      `Aktuell zugewiesenes LLM: ${currentAssignment ?? "none"}`
    ].join("\n\n");

    const reply = await provider.chat({
      systemPrompt,
      messages: [...history, { role: "user", content: message }]
    });

    await pgSaveChatMessage(getPool(), {
      sessionId,
      role: "user",
      content: message,
      agentId,
      repoId,
      llmId
    });
    const assistantMessage = await pgSaveChatMessage(getPool(), {
      sessionId,
      role: "assistant",
      content: reply,
      agentId,
      repoId,
      llmId
    });
    await pgSetLLMAssignment(getPool(), agentId, llmId, sessionId);

    res.status(201).json({
      reply,
      messageId: assistantMessage.id
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/runs", async (_req, res) => {
  try {
    const runs = useDb ? await pgListRuns(getPool()) : await runStore.list();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/runs/:id/state", async (req, res) => {
  try {
    if (useDb) {
      const run = await pgGetRunState(getPool(), req.params.id);
      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }
      res.json(run);
    } else {
      try {
        const run = await runStore.get(req.params.id);
        res.json(run);
      } catch (err) {
        if (isNotFoundError(err)) {
          res.status(404).json({ error: "Run not found" });
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/runs/:id/events", async (req, res) => {
  try {
    const events = useDb
      ? await pgListEvents(getPool(), req.params.id)
      : await eventStore.list(req.params.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/runs/:id/tasks", async (req, res) => {
  try {
    if (useDb) {
      const tasks = await pgListTasks(getPool(), req.params.id);
      res.json(tasks);
    } else {
      const store = new TaskStore(ROOT_PATH);
      const tasks = await store.listByRun(req.params.id);
      res.json(tasks);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/runs/:id/outputs", async (req, res) => {
  try {
    if (useDb) {
      const outputs = await pgListOutputs(getPool(), req.params.id);
      res.json(outputs);
    } else {
      try {
        const run = await runStore.get(req.params.id);
        const store = new OutputStore(ROOT_PATH);
        const outputs = await store.getMany(run.outputIds);
        res.json(outputs);
      } catch (err) {
        if (isNotFoundError(err)) {
          res.status(404).json({ error: "Run not found" });
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/hermes/feed-items", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Hermes feed items require database backend" });
      return;
    }

    const queryLimit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const items = await pgListFeedItems(getPool(), queryLimit);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/deferred-tasks", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Deferred tasks require database backend" });
      return;
    }

    const body = req.body as {
      addressee?: unknown;
      goal?: unknown;
      context?: unknown;
      createdBy?: unknown;
    };

    if (typeof body.addressee !== "string" || body.addressee.trim().length === 0) {
      res.status(400).json({ error: "addressee is required" });
      return;
    }

    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      res.status(400).json({ error: "goal is required" });
      return;
    }

    const deferredTask = await pgSaveDeferredTask(getPool(), {
      addressee: body.addressee.trim(),
      goal: body.goal.trim(),
      context: isRecord(body.context) ? body.context : null,
      createdBy: typeof body.createdBy === "string" && body.createdBy.trim().length > 0
        ? body.createdBy.trim()
        : undefined
    });

    res.status(201).json(deferredTask);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/deferred-tasks", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Deferred tasks require database backend" });
      return;
    }

    const addressee = typeof req.query.addressee === "string" ? req.query.addressee : undefined;
    const statusQuery = typeof req.query.status === "string" ? req.query.status : undefined;
    const statusResult = statusQuery
      ? DeferredTaskStatusSchema.safeParse(statusQuery)
      : { success: true as const, data: undefined };

    if (!statusResult.success) {
      res.status(400).json({ error: "Invalid deferred task status filter" });
      return;
    }

    const tasks = await pgListDeferredTasks(getPool(), {
      addressee,
      status: statusResult.data
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch("/deferred-tasks/:id/release", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Deferred tasks require database backend" });
      return;
    }

    const deferredTask = await pgReleaseDeferredTask(getPool(), req.params.id);

    if (!deferredTask) {
      res.status(404).json({ error: "Deferred task not found" });
      return;
    }

    res.json(deferredTask);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/architecture-snapshots", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Architecture snapshots require database backend" });
      return;
    }

    const body = req.body as {
      title?: unknown;
      mermaid?: unknown;
      notes?: unknown;
      id?: unknown;
    };

    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    if (typeof body.mermaid !== "string" || body.mermaid.trim().length === 0) {
      res.status(400).json({ error: "mermaid is required" });
      return;
    }

    const snapshot = await pgSaveArchitectureSnapshot(getPool(), {
      id: typeof body.id === "string" && body.id.trim().length > 0 ? body.id.trim() : undefined,
      title: body.title.trim(),
      mermaid: body.mermaid.trim(),
      notes:
        typeof body.notes === "string" && body.notes.trim().length > 0
          ? body.notes.trim()
          : null
    });

    res.status(201).json(snapshot);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/architecture-snapshots", async (_req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Architecture snapshots require database backend" });
      return;
    }

    const snapshots = await pgListArchitectureSnapshots(getPool());
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch("/runs/:id/cancel", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Cancel requires database backend" });
      return;
    }
    const run = await pgCancelRun(getPool(), req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found or already in terminal state" });
      return;
    }
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/runs", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "POST /runs requires database backend" });
      return;
    }
    const body = req.body as { goal?: unknown; projectId?: unknown };
    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      res.status(400).json({ error: "goal is required" });
      return;
    }
    const projectId = typeof body.projectId === "string" ? body.projectId : "sandbox";
    const run = await pgCreatePendingRun(getPool(), body.goal.trim(), projectId);
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/hermes/nightly", async (req, res) => {
  try {
    if (!useDb) {
      res.status(503).json({ error: "Hermes nightly requires database backend" });
      return;
    }

    const configuredSecret = process.env.HERMES_CRON_SECRET;
    if (!configuredSecret) {
      res.status(503).json({ error: "HERMES_CRON_SECRET is not configured" });
      return;
    }

    if (req.header("x-hermes-secret") !== configuredSecret) {
      res.status(401).json({ error: "Unauthorized Hermes nightly trigger" });
      return;
    }

    const body = req.body as {
      summaryLookbackHours?: unknown;
      githubLookbackHours?: unknown;
    };
    const runtime = createHermesRuntime(getPool());
    const result = await runtime.createNightlyMailer().run({
      summaryLookbackHours: parseOptionalPositiveInt(body.summaryLookbackHours),
      githubLookbackHours: parseOptionalPositiveInt(body.githubLookbackHours)
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredString(value: unknown, _fieldName: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function extractGithubError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.message === "string" ? payload.message : null;
}

async function ensureRegistrySeeded(): Promise<RegistryEntry[]> {
  if (!registrySeedPromise) {
    registrySeedPromise = registryStore.seed(createDefaultRegistry());
  }

  return registrySeedPromise;
}

async function listRegistryEntries(): Promise<RegistryEntry[]> {
  await ensureRegistrySeeded();
  return registryStore.list();
}

async function resolveRegistryEntry(query: string): Promise<RegistryEntry | null> {
  await ensureRegistrySeeded();
  return registryStore.resolve(query);
}

async function readBootstrapPrompt(bootstrapPath: string): Promise<string> {
  const cachedPrompt = bootstrapCache.get(bootstrapPath);

  if (cachedPrompt) {
    return cachedPrompt;
  }

  const absolutePath = path.resolve(ROOT_PATH, bootstrapPath);
  const prompt = await readFile(absolutePath, "utf8");
  bootstrapCache.set(bootstrapPath, prompt);
  return prompt;
}
