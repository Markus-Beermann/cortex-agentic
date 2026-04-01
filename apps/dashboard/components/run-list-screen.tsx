"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { getErrorMessage, readJson } from "@/lib/api-client";
import { formatCount, formatShortId, formatTimestamp } from "@/lib/format";
import type { RunState } from "@/lib/types";

import { RefreshPill } from "./refresh-pill";
import { StatusBadge } from "./status-badge";

type RunsSnapshot = {
  error: string | null;
  isLoading: boolean;
  lastUpdated: string | null;
  runs: RunState[];
};

const INITIAL_SNAPSHOT: RunsSnapshot = {
  error: null,
  isLoading: true,
  lastUpdated: null,
  runs: []
};

export function RunListScreen() {
  const [snapshot, setSnapshot] = useState<RunsSnapshot>(INITIAL_SNAPSHOT);

  const loadRuns = useEffectEvent(async () => {
    try {
      const runs = await readJson<RunState[]>("/api/runs");

      startTransition(() => {
        setSnapshot({
          error: null,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          runs
        });
      });
    } catch (error) {
      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: getErrorMessage(error),
          isLoading: false,
          lastUpdated: new Date().toISOString()
        }));
      });
    }
  });

  useEffect(() => {
    void loadRuns();

    const intervalId = window.setInterval(() => {
      void loadRuns();
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="shell">
      <div className="page-stack">
        <section className="panel hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Cortex Dashboard</span>
              <h1>Run visibility without terminal archaeology.</h1>
              <p>
                Live list of orchestration runs with status, queue pressure, approval load,
                and quick access to details. Mobile first, because keyboards are apparently
                optional now.
              </p>
            </div>
            <RefreshPill lastUpdated={snapshot.lastUpdated} />
          </div>
        </section>

        <section className="panel panel-content">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Runs</p>
              <h2 className="section-title">{formatCount(snapshot.runs.length, "run")}</h2>
              <p className="section-copy">
                Auto-refresh is on. The backend decides the truth; the UI just reports the damage.
              </p>
            </div>
          </div>

          {snapshot.error ? (
            <div className="error-banner">
              Failed to load runs: {snapshot.error}
            </div>
          ) : null}

          {snapshot.isLoading ? (
            <div className="empty-state">Loading runs…</div>
          ) : null}

          {!snapshot.isLoading && snapshot.runs.length === 0 ? (
            <div className="empty-state">No runs found.</div>
          ) : null}

          {snapshot.runs.length > 0 ? (
            <div className="run-grid">
              {snapshot.runs.map((run) => (
                <Link key={run.id} href={`/runs/${run.id}`} className="run-card">
                  <div className="run-card-top">
                    <StatusBadge status={run.status} />
                    <span className="run-card-id">{formatShortId(run.id)}</span>
                  </div>

                  <div className="stack">
                    <h2 className="run-card-title">{run.goal}</h2>
                    <p className="run-card-copy">Project {run.projectId}</p>
                  </div>

                  <div className="meta-grid">
                    <div className="meta-card">
                      <span className="meta-label">Updated</span>
                      <p className="meta-value">{formatTimestamp(run.updatedAt)}</p>
                    </div>
                    <div className="meta-card">
                      <span className="meta-label">Created</span>
                      <p className="meta-value">{formatTimestamp(run.createdAt)}</p>
                    </div>
                    <div className="meta-card">
                      <span className="meta-label">Completed</span>
                      <p className="meta-value">{formatCount(run.completedTaskIds.length, "task")}</p>
                    </div>
                    <div className="meta-card">
                      <span className="meta-label">Approvals</span>
                      <p className="meta-value">
                        {formatCount(run.pendingApprovalIds.length, "pending request")}
                      </p>
                    </div>
                  </div>

                  <span className="card-link">Open run detail</span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
