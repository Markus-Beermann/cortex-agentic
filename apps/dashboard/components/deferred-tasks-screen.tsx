"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useState } from "react";

import { getErrorMessage, readJson, sendJson } from "@/lib/api-client";
import { formatCount, formatTimestamp } from "@/lib/format";
import type { DeferredTask } from "@/lib/types";

import { RefreshPill } from "./refresh-pill";

type DeferredTasksSnapshot = {
  error: string | null;
  isLoading: boolean;
  isReleasingId: string | null;
  lastUpdated: string | null;
  tasks: DeferredTask[];
};

const INITIAL_SNAPSHOT: DeferredTasksSnapshot = {
  error: null,
  isLoading: true,
  isReleasingId: null,
  lastUpdated: null,
  tasks: []
};

const PREFERRED_ORDER = ["tony", "sigmund", "dino", "debussy", "george"];

export function DeferredTasksScreen() {
  const [snapshot, setSnapshot] = useState<DeferredTasksSnapshot>(INITIAL_SNAPSHOT);

  const loadTasks = useEffectEvent(async () => {
    try {
      const tasks = await readJson<DeferredTask[]>("/api/deferred-tasks?status=pending");

      startTransition(() => {
        setSnapshot((current) => ({
          ...current,
          error: null,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          tasks
        }));
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
    void loadTasks();

    const intervalId = window.setInterval(() => {
      void loadTasks();
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleRelease = useCallback(async (taskId: string) => {
    setSnapshot((current) => ({
      ...current,
      isReleasingId: taskId
    }));

    try {
      await sendJson(`/api/deferred-tasks/${taskId}/release`, "PATCH");
      await loadTasks();
    } catch (error) {
      setSnapshot((current) => ({
        ...current,
        error: getErrorMessage(error)
      }));
    } finally {
      setSnapshot((current) => ({
        ...current,
        isReleasingId: null
      }));
    }
  }, []);

  const groupedTasks = groupTasks(snapshot.tasks);

  return (
    <main className="shell">
      <div className="page-stack">
        <section className="panel hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Deferred Tasks</span>
              <h1>Quiet backlog, visible before it becomes archaeology.</h1>
              <p>
                Pending deferred tasks grouped by addressee, with direct release control for the
                jobs that are waiting in the wings instead of pretending to be gone.
              </p>
            </div>
            <RefreshPill lastUpdated={snapshot.lastUpdated} />
          </div>
        </section>

        <section className="panel panel-content">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Tasks</p>
              <h2 className="section-title">{formatCount(snapshot.tasks.length, "pending task")}</h2>
              <p className="section-copy">
                Auto-refresh is on. Release moves a task out of pending state immediately.
              </p>
            </div>
          </div>

          {snapshot.error ? (
            <div className="error-banner">Failed to load deferred tasks: {snapshot.error}</div>
          ) : null}

          {snapshot.isLoading ? (
            <div className="empty-state">Loading deferred tasks…</div>
          ) : null}

          {!snapshot.isLoading && snapshot.tasks.length === 0 ? (
            <div className="empty-state">Keine pending Tasks.</div>
          ) : null}

          {groupedTasks.length > 0 ? (
            <div className="deferred-groups">
              {groupedTasks.map(([addressee, tasks]) => (
                <section key={addressee} className="deferred-group">
                  <div className="deferred-group-header">
                    <span className={`addressee-badge ${getAddresseeBadgeClass(addressee)}`}>
                      {formatAddressee(addressee)}
                    </span>
                    <h2 className="deferred-group-title">
                      {formatCount(tasks.length, "pending task")}
                    </h2>
                  </div>

                  <div className="deferred-group-list">
                    {tasks.map((task) => (
                      <article key={task.id} className="deferred-card">
                        <div className="deferred-card-top">
                          <span className={`addressee-badge ${getAddresseeBadgeClass(task.addressee)}`}>
                            {formatAddressee(task.addressee)}
                          </span>
                          <span className="run-card-id">{task.id.slice(0, 8)}</span>
                        </div>

                        <div className="stack">
                          <p className="deferred-card-goal">{task.goal}</p>
                          <p className="run-card-copy">
                            Created {formatTimestamp(task.createdAt)} by {task.createdBy}
                          </p>
                        </div>

                        <div className="deferred-card-footer">
                          {task.status === "pending" ? (
                            <button
                              type="button"
                              className="release-btn"
                              disabled={snapshot.isReleasingId === task.id}
                              onClick={() => void handleRelease(task.id)}
                            >
                              {snapshot.isReleasingId === task.id ? "Releasing…" : "Release"}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function groupTasks(tasks: DeferredTask[]): Array<[string, DeferredTask[]]> {
  const grouped = new Map<string, DeferredTask[]>();

  for (const task of tasks) {
    const key = task.addressee.toLowerCase();
    const existingTasks = grouped.get(key) ?? [];
    existingTasks.push(task);
    grouped.set(key, existingTasks);
  }

  return Array.from(grouped.entries()).sort(([left], [right]) => {
    const leftIndex = PREFERRED_ORDER.indexOf(left);
    const rightIndex = PREFERRED_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function formatAddressee(value: string): string {
  if (value.length === 0) {
    return "Unknown";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getAddresseeBadgeClass(addressee: string): string {
  switch (addressee.toLowerCase()) {
    case "tony":
      return "addressee-badge-tony";
    case "sigmund":
      return "addressee-badge-sigmund";
    case "dino":
      return "addressee-badge-dino";
    case "debussy":
      return "addressee-badge-debussy";
    case "george":
      return "addressee-badge-george";
    default:
      return "";
  }
}
