import { CalendarDays, MapPin, Pencil, Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { EventCreateForm } from "@/components/events/EventCreateForm";
import { FormError } from "@/components/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useUpdateEvent } from "@/hooks/useEvents";
import { formatDateTime } from "@/lib/dates";
export function EventDetails({ event }: { event: Event }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateEvent(event.id);
  const [editing, setEditing] = useState(false),
    [cancelling, setCancelling] = useState(false);
  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-4 flex gap-2">
            <Badge>{t(`kinds.${event.kind}`)}</Badge>
            {event.venue && <Badge variant="secondary">{t(`venues.${event.venue}`)}</Badge>}
            {event.is_cancelled && <Badge variant="destructive">{t("events.cancelled")}</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          {event.opponent && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("events.versus", { opponent: event.opponent })}
            </p>
          )}
        </div>
        {!event.is_cancelled && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Modifier
          </Button>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 border-t pt-5 text-xs">
        <p className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" />
          {formatDateTime(event.starts_at, i18n.language)}
        </p>
        {event.location && (
          <a
            className="flex items-center gap-2 hover:underline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} className="text-primary" />
            {event.location}
          </a>
        )}
        {event.meeting_at && (
          <p className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            {t("events.meeting", { time: formatDateTime(event.meeting_at, i18n.language) })}
          </p>
        )}
      </div>
      {event.notes && (
        <p className="mt-5 whitespace-pre-wrap rounded-lg bg-muted/70 p-4 text-sm leading-relaxed">
          {event.notes}
        </p>
      )}
      <div className="mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={update.isPending}
          onClick={() =>
            event.is_cancelled ? update.mutate({ is_cancelled: false }) : setCancelling(true)
          }
        >
          {event.is_cancelled ? "Rétablir l’événement" : t("events.cancel")}
        </Button>
        <FormError error={update.error} />
      </div>
      {editing && (
        <Modal title="Modifier l’événement" onClose={() => setEditing(false)}>
          <EventCreateForm
            teamId={event.team_id}
            event={event}
            onSuccess={() => setEditing(false)}
          />
        </Modal>
      )}
      {cancelling && (
        <Modal title="Annuler cet événement ?" onClose={() => setCancelling(false)}>
          <p className="mb-5 text-sm leading-relaxed">
            L’événement restera visible dans le calendrier avec la mention « Annulé ». Vous pourrez
            le rétablir à tout moment.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelling(false)}>
              Conserver
            </Button>
            <Button
              variant="destructive"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ is_cancelled: true }, { onSuccess: () => setCancelling(false) })
              }
            >
              Confirmer l’annulation
            </Button>
          </div>
          <FormError error={update.error} />
        </Modal>
      )}
    </section>
  );
}
