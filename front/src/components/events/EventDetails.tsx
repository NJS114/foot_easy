import { CalendarDays, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCancelEvent } from "@/hooks/useEvents";
import { formatDateTime } from "@/lib/dates";

export function EventDetails({ event }: { event: Event }) {
  const { t, i18n } = useTranslation();
  const cancelEvent = useCancelEvent();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(`kinds.${event.kind}`)}</Badge>
        {event.venue && <Badge variant="secondary">{t(`venues.${event.venue}`)}</Badge>}
        {event.is_cancelled && <Badge variant="destructive">{t("events.cancelled")}</Badge>}
      </div>
      <h1 className="text-2xl font-bold">
        {event.title}
        {event.opponent && (
          <span className="font-normal text-muted-foreground">
            {" "}
            {t("events.versus", { opponent: event.opponent })}
          </span>
        )}
      </h1>
      <p className="flex items-center gap-2 text-sm">
        <CalendarDays aria-hidden className="size-4" />
        {formatDateTime(event.starts_at, i18n.language)}
      </p>
      {event.meeting_at && (
        <p className="text-sm text-muted-foreground">
          {t("events.meeting", { time: formatDateTime(event.meeting_at, i18n.language) })}
        </p>
      )}
      {event.location && (
        <p className="flex items-center gap-2 text-sm">
          <MapPin aria-hidden className="size-4" />
          {event.location}
        </p>
      )}
      {!event.is_cancelled && (
        <Button
          variant="outline"
          className="self-start"
          disabled={cancelEvent.isPending}
          onClick={() => cancelEvent.mutate(event.id)}
        >
          {t("events.cancel")}
        </Button>
      )}
    </section>
  );
}
