import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Event, Team } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";

export function EventRow({ event, team }: { event: Event; team?: Team }) {
  const { t, i18n } = useTranslation();
  const hasScore = event.score_for != null && event.score_against != null;
  return (
    <Link
      to={`/events/${event.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 px-3 py-2 hover:bg-accent"
      style={{ borderLeftColor: team?.color ?? "transparent" }}
    >
      <Badge variant={event.kind === "match" ? "default" : "secondary"}>
        {t(`kinds.${event.kind}`)}
      </Badge>
      {team && <span className="text-sm font-semibold">{team.name}</span>}
      <span className="font-medium">{event.title}</span>
      {event.opponent && (
        <span className="text-sm text-muted-foreground">
          {t("events.versus", { opponent: event.opponent })}
        </span>
      )}
      {hasScore && (
        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-sm text-white">
          {event.score_for} - {event.score_against}
        </span>
      )}
      {event.is_cancelled && <Badge variant="destructive">{t("events.cancelled")}</Badge>}
      <span className="ml-auto text-sm text-muted-foreground">
        {formatDateTime(event.starts_at, i18n.language)}
      </span>
    </Link>
  );
}
