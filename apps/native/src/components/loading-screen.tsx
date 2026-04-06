import type { ReactNode } from "react";

export function LoadingScreen(): ReactNode {
  return (
    <main className="shell">
      <div className="empty-state">Loading…</div>
    </main>
  );
}
