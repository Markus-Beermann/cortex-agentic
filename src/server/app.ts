import express from "express";

import { EventLogStore } from "../state/event-log.store";
import { RunStateStore } from "../state/run-state.store";
import { getPool } from "./db";
import { pgGetRunState, pgListEvents, pgListRuns } from "./pg-queries";

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

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
