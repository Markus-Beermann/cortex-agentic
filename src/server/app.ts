import express from "express";

import { EventLogStore } from "../state/event-log.store";
import { OutputStore } from "../state/output.store";
import { RunStateStore } from "../state/run-state.store";
import { TaskStore } from "../state/task.store";
import { getPool } from "./db";
import {
  pgCancelRun,
  pgCreatePendingRun,
  pgGetRunState,
  pgListEvents,
  pgListOutputs,
  pgListRuns,
  pgListTasks
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

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
