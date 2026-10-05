import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Event } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { useEvents } from "@/hooks/useEvents";
import { formatDateTime } from "@/lib/dates";

function EventRow({ event }: { event: Event }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/events/${event.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-accent"
    >
      <Badge variant={event.kind === "match" ? "default" : "secondary"}>
        {t(`kinds.${event.kind}`)}
      </Badge>
      <span className="font-medium">{event.title}</span>
      {event.opponent && (
        <span className="text-sm text-muted-foreground">
          {t("events.versus", { opponent: event.opponent })}
        </span>
      )}
      {event.is_cancelled && <Badge variant="destructive">{t("events.cancelled")}</Badge>}
      <span className="ml-auto text-sm text-muted-foreground">
        {formatDateTime(event.starts_at, i18n.language)}
      </span>
    </Link>
  );
}

export function EventList({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useEvents(teamId);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("events.empty")} />;

  return (
    <ul className="divide-y rounded-md border">
      {data.items.map((event) => (
        <li key={event.id}>
          <EventRow event={event} />
        </li>
      ))}
    </ul>
  );
}
