import { formatRefreshTime } from "@/lib/format";

type RefreshPillProps = {
  lastUpdated: string | null;
};

export function RefreshPill({ lastUpdated }: RefreshPillProps) {
  return (
    <div className="refresh-pill" aria-live="polite">
      <span className="refresh-dot" aria-hidden="true" />
      <span>
        <strong>Live refresh</strong>
        {lastUpdated ? ` every 5s · updated ${formatRefreshTime(lastUpdated)}` : " every 5s"}
      </span>
    </div>
  );
}
