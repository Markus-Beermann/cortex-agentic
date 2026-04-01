import { formatEventDetails, formatEventLabel, formatTimestamp, getEventTone } from "@/lib/format";
import type { RunEvent } from "@/lib/types";

type EventsTimelineProps = {
  events: RunEvent[];
};

export function EventsTimeline({ events }: EventsTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        No events available yet. Either nothing happened, or the backend is having a moment.
      </div>
    );
  }

  return (
    <ol className="timeline">
      {events.map((event) => {
        const tone = getEventTone(event);

        return (
          <li key={event.id} className="timeline-item">
            <div className="timeline-line" aria-hidden="true">
              <span className={`timeline-dot timeline-dot-${tone}`} />
            </div>
            <article className="timeline-body">
              <div className="event-head">
                <h3 className="event-label">{formatEventLabel(event)}</h3>
                <time className="event-time" dateTime={event.timestamp}>
                  {formatTimestamp(event.timestamp)}
                </time>
              </div>
              <p className="event-details">{formatEventDetails(event)}</p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
