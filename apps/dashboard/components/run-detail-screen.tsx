"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { getErrorMessage, readJson } from "@/lib/api-client";
import { buildRunGraph } from "@/lib/run-graph";
import { formatCount, formatShortId, formatTimestamp, isTerminalRunStatus } from "@/lib/format";
import type { RunEvent, RunState } from "@/lib/types";

import { EventsTimeline } from "./events-timeline";
import { HandoffMermaid } from "./handoff-mermaid";
import { RefreshPill } from "./refresh-pill";
import { StatusBadge } from "./status-badge";

type RunDetailScreenProps = {
  runId: string;
};

type RunDetailSnapshot = {
  events: RunEvent[];
  eventsError: string | null;
  isLoading: boolean;
  lastUpdated: string | null;
  run: RunState | null;
  runError: string | null;
};

const INITIAL_SNAPSHOT: RunDetailSnapshot = {
  events: [],
  eventsError: null,
  isLoading: true,
  lastUpdated: null,
  run: null,
  runError: null
};

export function RunDetailScreen({ runId }: RunDetailScreenProps) {
  const [snapshot, setSnapshot] = useState<RunDetailSnapshot>(INITIAL_SNAPSHOT);
  const shouldPoll = !snapshot.run || !isTerminalRunStatus(snapshot.run.status);

  const loadRunDetail = useEffectEvent(async () => {
    const [runResult, eventsResult] = await Promise.allSettled([
      readJson<RunState>(`/api/runs/${runId}/state`),
      readJson<RunEvent[]>(`/api/runs/${runId}/events`)
    ]);

    startTransition(() => {
      setSnapshot((current) => ({
        events:
          eventsResult.status === "fulfilled" ? eventsResult.value : current.events,
        eventsError:
          eventsResult.status === "fulfilled" ? null : getErrorMessage(eventsResult.reason),
        isLoading: false,
        lastUpdated: new Date().toISOString(),
        run:
          runResult.status === "fulfilled" ? runResult.value : current.run,
        runError:
          runResult.status === "fulfilled" ? null : getErrorMessage(runResult.reason)
      }));
    });
  });

  useEffect(() => {
    void loadRunDetail();
  }, [runId]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadRunDetail();
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [shouldPoll]);

  const graph = buildRunGraph(snapshot.run, snapshot.events);

  return (
    <main className="shell detail-shell">
      <div className="page-stack">
        <Link href="/" className="back-link">
          Back to runs
        </Link>

        <section className="panel hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Run Detail</span>
              <h1>{snapshot.run ? snapshot.run.goal : `Run ${formatShortId(runId)}`}</h1>
              <p>
                Event chronology, run state, and the canonical handoff chain from coordinator
                to reviewer. When the backend behaves, this is pleasant.
              </p>
            </div>
            <RefreshPill lastUpdated={snapshot.lastUpdated} />
          </div>
        </section>

        {snapshot.runError ? (
          <div className="error-banner">
            Failed to load the run state: {snapshot.runError}
          </div>
        ) : null}

        {snapshot.isLoading && !snapshot.run ? (
          <div className="empty-state">Loading run detail…</div>
        ) : null}

        {snapshot.run ? (
          <div className="detail-grid">
            <section className="panel panel-content">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Overview</p>
                  <h2 className="section-title">{formatShortId(snapshot.run.id)}</h2>
                  <p className="section-copy">
                    Project {snapshot.run.projectId}
                  </p>
                </div>
                <StatusBadge status={snapshot.run.status} />
              </div>

              <div className="stats-grid">
                <div className="meta-card">
                  <span className="meta-label">Created</span>
                  <p className="meta-value">{formatTimestamp(snapshot.run.createdAt)}</p>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Updated</span>
                  <p className="meta-value">{formatTimestamp(snapshot.run.updatedAt)}</p>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Completed</span>
                  <p className="meta-value">
                    {formatCount(snapshot.run.completedTaskIds.length, "task")}
                  </p>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Outputs</span>
                  <p className="meta-value">
                    {formatCount(snapshot.run.outputIds.length, "artifact")}
                  </p>
                </div>
              </div>
            </section>

            <section className="panel panel-content">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Load</p>
                  <h2 className="section-title">Operational counters</h2>
                  <p className="section-copy">
                    Queue and approval pressure, without pretending this is observability nirvana.
                  </p>
                </div>
              </div>

              <div className="metric-strip">
                <div className="metric-card">
                  <strong>{snapshot.run.queuedTaskIds.length}</strong>
                  <span>Queued tasks</span>
                </div>
                <div className="metric-card">
                  <strong>{snapshot.run.pendingApprovalIds.length}</strong>
                  <span>Pending approvals</span>
                </div>
                <div className="metric-card">
                  <strong>{snapshot.run.activeTaskId ? 1 : 0}</strong>
                  <span>Active task</span>
                </div>
              </div>
            </section>

            <section className="panel panel-content">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Handoffs</p>
                  <h2 className="section-title">Agent path</h2>
                  <p className="section-copy">
                    Coordinator to architect to implementer to reviewer. Active connection is
                    highlighted when the data exists.
                  </p>
                </div>
              </div>

              <HandoffMermaid definition={graph.definition} caption={graph.caption} />
            </section>

            <section className="panel panel-content timeline-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Timeline</p>
                  <h2 className="section-title">Run events</h2>
                  <p className="section-copy">
                    Ordered event stream from the state server.
                  </p>
                </div>
              </div>

              {snapshot.eventsError ? (
                <div className="notice-banner">
                  Event loading failed: {snapshot.eventsError}
                </div>
              ) : null}

              <EventsTimeline events={snapshot.events} />
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
