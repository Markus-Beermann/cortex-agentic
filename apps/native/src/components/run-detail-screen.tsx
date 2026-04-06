import { startTransition, useCallback, useEffect, useEffectEvent, useState } from "react";
import { Link } from "react-router-dom";

import { getErrorMessage } from "@/lib/api-client";
import { buildRunGraph } from "@/lib/run-graph";
import { formatCount, formatShortId, formatTimestamp, isTerminalRunStatus } from "@/lib/format";
import type { Output, RunEvent, RunState, Task } from "@/lib/types";
import { useApiClient } from "@/lib/use-api-client";

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
  outputs: Output[];
  run: RunState | null;
  runError: string | null;
  tasks: Task[];
};

const INITIAL_SNAPSHOT: RunDetailSnapshot = {
  events: [],
  eventsError: null,
  isLoading: true,
  lastUpdated: null,
  outputs: [],
  run: null,
  runError: null,
  tasks: []
};

const ROLE_LABELS: Record<string, string> = {
  coordinator: "Coordinator",
  architect: "Architect",
  implementer: "Implementer",
  reviewer: "Reviewer"
};

type RoutingProfile = {
  complexity: string;
  reviewMode: string;
  routingStrategy: string;
  targetRole: string | null;
  workType: string;
  rationale: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readPayloadStringList(
  payload: Record<string, unknown>,
  key: string
): string[] {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function readRoutingProfile(events: RunEvent[]): RoutingProfile | null {
  const routingEvent = [...events]
    .reverse()
    .find(
      (event) => event.eventType === "routing.profile_selected" && isRecord(event.payload)
    );

  if (!routingEvent || !isRecord(routingEvent.payload)) {
    return null;
  }

  const payload = routingEvent.payload;
  const workType = readPayloadString(payload, "workType");
  const complexity = readPayloadString(payload, "complexity");
  const routingStrategy = readPayloadString(payload, "routingStrategy");
  const reviewMode = readPayloadString(payload, "reviewMode");

  if (!workType || !complexity || !routingStrategy || !reviewMode) {
    return null;
  }

  return {
    workType,
    complexity,
    routingStrategy,
    reviewMode,
    targetRole: readPayloadString(payload, "targetRole"),
    rationale: readPayloadStringList(payload, "rationale")
  };
}

export function RunDetailScreen({ runId }: RunDetailScreenProps) {
  const { apiClient, isAuthLoaded } = useApiClient();
  const [snapshot, setSnapshot] = useState<RunDetailSnapshot>(INITIAL_SNAPSHOT);
  const [isCancelling, setIsCancelling] = useState(false);
  const shouldPoll = !snapshot.run || !isTerminalRunStatus(snapshot.run.status);
  const routingProfile = readRoutingProfile(snapshot.events);

  const loadRunDetail = useEffectEvent(async () => {
    if (!isAuthLoaded) {
      return;
    }

    const [runResult, eventsResult, tasksResult, outputsResult] = await Promise.allSettled([
      apiClient.readRunState(runId),
      apiClient.readRunEvents(runId),
      apiClient.listTasks(runId),
      apiClient.listOutputs(runId)
    ]);

    startTransition(() => {
      setSnapshot((current) => ({
        events: eventsResult.status === "fulfilled" ? eventsResult.value : current.events,
        eventsError: eventsResult.status === "fulfilled" ? null : getErrorMessage(eventsResult.reason),
        isLoading: false,
        lastUpdated: new Date().toISOString(),
        outputs: outputsResult.status === "fulfilled" ? outputsResult.value : current.outputs,
        run: runResult.status === "fulfilled" ? runResult.value : current.run,
        runError: runResult.status === "fulfilled" ? null : getErrorMessage(runResult.reason),
        tasks: tasksResult.status === "fulfilled" ? tasksResult.value : current.tasks
      }));
    });
  });

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    void loadRunDetail();
  }, [isAuthLoaded, runId]);

  useEffect(() => {
    if (!shouldPoll) return;
    const intervalId = window.setInterval(() => void loadRunDetail(), 5_000);
    return () => window.clearInterval(intervalId);
  }, [loadRunDetail, shouldPoll]);

  const handleCancel = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await apiClient.cancelRun(runId);
      await loadRunDetail();
    } catch {
      // ignore — run might already be terminal
    } finally {
      setIsCancelling(false);
    }
  }, [apiClient, isCancelling, loadRunDetail, runId]);

  const graph = buildRunGraph(snapshot.run, snapshot.events);
  const canCancel = snapshot.run && !isTerminalRunStatus(snapshot.run.status);

  return (
    <main className="shell detail-shell">
      <div className="page-stack">
        <Link to="/" className="back-link">Back to runs</Link>

        <section className="panel hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Run Detail</span>
              <h1>{snapshot.run ? snapshot.run.goal : `Run ${formatShortId(runId)}`}</h1>
              <p>
                Event chronology, agent outputs, and the canonical handoff chain.
              </p>
            </div>
            <RefreshPill lastUpdated={snapshot.lastUpdated} />
          </div>
        </section>

        {snapshot.runError ? (
          <div className="error-banner">Failed to load the run state: {snapshot.runError}</div>
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
                  <p className="section-copy">Project {snapshot.run.projectId}</p>
                </div>
                <div className="overview-actions">
                  <StatusBadge status={snapshot.run.status} />
                  {canCancel ? (
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => void handleCancel()}
                      disabled={isCancelling}
                    >
                      {isCancelling ? "Cancelling…" : "Cancel run"}
                    </button>
                  ) : null}
                </div>
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
                  <p className="meta-value">{formatCount(snapshot.run.completedTaskIds.length, "task")}</p>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Outputs</span>
                  <p className="meta-value">{formatCount(snapshot.run.outputIds.length, "artifact")}</p>
                </div>
                {routingProfile ? (
                  <div className="meta-card">
                    <span className="meta-label">Routing</span>
                    <p className="meta-value">{routingProfile.routingStrategy}</p>
                  </div>
                ) : null}
                {routingProfile ? (
                  <div className="meta-card">
                    <span className="meta-label">Complexity</span>
                    <p className="meta-value">{routingProfile.complexity}</p>
                  </div>
                ) : null}
                {routingProfile ? (
                  <div className="meta-card">
                    <span className="meta-label">Review mode</span>
                    <p className="meta-value">{routingProfile.reviewMode}</p>
                  </div>
                ) : null}
                {routingProfile ? (
                  <div className="meta-card">
                    <span className="meta-label">Next role</span>
                    <p className="meta-value">{routingProfile.targetRole ?? "complete"}</p>
                  </div>
                ) : null}
              </div>
              {routingProfile ? (
                <div className="notice-banner">
                  <strong>Routing profile:</strong> {routingProfile.workType} work via{" "}
                  {routingProfile.routingStrategy}. {routingProfile.rationale.join(" ")}
                </div>
              ) : null}
            </section>

            <section className="panel panel-content">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Load</p>
                  <h2 className="section-title">Operational counters</h2>
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
                </div>
              </div>
              <HandoffMermaid definition={graph.definition} caption={graph.caption} />
            </section>

            {snapshot.outputs.length > 0 ? (
              <section className="panel panel-content timeline-panel">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">Agent Outputs</p>
                    <h2 className="section-title">
                      {formatCount(snapshot.outputs.length, "output")}
                    </h2>
                    <p className="section-copy">
                      What each agent produced — summaries, decisions, and artifacts.
                    </p>
                  </div>
                </div>
                <div className="output-stack">
                  {snapshot.outputs.map((output) => (
                    <div key={output.id} className="output-card">
                      <div className="output-head">
                        <span className={`role-badge role-badge-${output.roleId}`}>
                          {ROLE_LABELS[output.roleId] ?? output.roleId}
                        </span>
                        <span className="output-time">{formatTimestamp(output.createdAt)}</span>
                      </div>

                      <p className="output-summary">{output.summary}</p>

                      {output.blockers.length > 0 ? (
                        <div className="output-blockers">
                          {output.blockers.map((b, i) => (
                            <p key={i} className="output-blocker">⚠ {b}</p>
                          ))}
                        </div>
                      ) : null}

                      {output.decisions.length > 0 ? (
                        <ul className="output-decisions">
                          {output.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      ) : null}

                      {output.artifacts.map((a, i) => (
                        <div key={i} className="artifact-preview">
                          <span className="artifact-kind">{a.kind}</span>
                          {a.path ? <span className="artifact-path">{a.path}</span> : null}
                          <p className="artifact-content">
                            {a.content.length > 320 ? `${a.content.slice(0, 320)}…` : a.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="panel panel-content timeline-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Timeline</p>
                  <h2 className="section-title">Run events</h2>
                </div>
              </div>
              {snapshot.eventsError ? (
                <div className="notice-banner">Event loading failed: {snapshot.eventsError}</div>
              ) : null}
              <EventsTimeline events={snapshot.events} />
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
