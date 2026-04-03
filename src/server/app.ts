import express from "express";

import { DeferredTaskStatusSchema } from "../core/contracts";
import { createHermesRuntime } from "../hermes/runtime";
import { EventLogStore } from "../state/event-log.store";
import { OutputStore } from "../state/output.store";
import { RunStateStore } from "../state/run-state.store";
import { TaskStore } from "../state/task.store";
import { getPool } from "./db";
import {
  pgCancelRun,
  pgCreatePendingRun,
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
  pgSaveDeferredTask
} from "./pg-queries";

const ROOT_PATH = process.env.ORCHESTRATOR_ROOT ?? process.cwd();
const DATABASE_PUBLIC_URL = process.env.DATABASE_PUBLIC_URL;
const useDb = Boolean(DATABASE_PUBLIC_URL);

if (!useDb) {
  console.warn("[server] WARNING: DATABASE_PUBLIC_URL not set, using filesystem fallback");
}

const runStore = new RunStateStore(ROOT_PATH);
const eventStore = new EventLogStore(ROOT_PATH);

export const app = express();

app.use(express.json());

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
