"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { getErrorMessage, readJson, sendJson } from "@/lib/api-client";
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
  const [showModal, setShowModal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [projectInput, setProjectInput] = useState("sandbox");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);

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

  const openModal = useCallback(() => {
    setGoalInput("");
    setProjectInput("sandbox");
    setSubmitError(null);
    setShowModal(true);
    setTimeout(() => goalRef.current?.focus(), 60);
  }, []);

  const closeModal = useCallback(() => {
    if (isSubmitting) return;
    setShowModal(false);
  }, [isSubmitting]);

  const handleSubmitRun = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const goal = goalInput.trim();
    if (!goal || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await sendJson("/api/runs", "POST", { goal, projectId: projectInput.trim() || "sandbox" });
      setShowModal(false);
      void loadRuns();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [goalInput, projectInput, isSubmitting]);

  return (
    <>
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
            <button type="button" className="new-run-btn" onClick={openModal}>
              + New run
            </button>
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

    {showModal ? (

      <div className="modal-backdrop" onClick={closeModal}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">New run</h2>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
          </div>
          <form onSubmit={(e) => void handleSubmitRun(e)} className="modal-form">
            <label className="modal-label" htmlFor="goal-input">
              Goal
            </label>
            <textarea
              id="goal-input"
              ref={goalRef}
              className="modal-textarea"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="Describe what the orchestrator should accomplish…"
              rows={4}
              required
              disabled={isSubmitting}
            />
            <label className="modal-label" htmlFor="project-input">
              Project ID
            </label>
            <input
              id="project-input"
              type="text"
              className="modal-input"
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              placeholder="sandbox"
              disabled={isSubmitting}
            />
            {submitError ? (
              <div className="error-banner">{submitError}</div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="modal-cancel-btn" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="modal-submit-btn" disabled={!goalInput.trim() || isSubmitting}>
                {isSubmitting ? "Starting…" : "Start run"}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null}
    </>
  );
}
