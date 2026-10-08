import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Event as ClubEvent, EventCreate } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateEvent, useCreateEventSeries, useUpdateEvent } from "@/hooks/useEvents";
import { fieldErrorFor } from "@/lib/formErrors";
import { localInputToIso } from "@/lib/dates";
const KINDS: EventCreate["kind"][] = ["match", "training", "tournament", "other"];
function inputDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function EventCreateForm({
  teamId,
  event: existing,
  onSuccess,
}: {
  teamId: string;
  event?: ClubEvent;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateEvent(),
    series = useCreateEventSeries(),
    update = useUpdateEvent(existing?.id ?? "");
  const [kind, setKind] = useState<EventCreate["kind"]>(existing?.kind ?? "match");
  const [repeat, setRepeat] = useState(false),
    [saved, setSaved] = useState(false);
  const mutation = existing ? update : repeat ? series : create;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    const form = event.currentTarget,
      data = new FormData(form);
    const optional = (key: string) => String(data.get(key) || "").trim() || null;
    const date = (key: string) => (optional(key) ? localInputToIso(String(data.get(key))) : null);
    const body: EventCreate = {
      team_id: teamId,
      kind,
      title: String(data.get("title")),
      starts_at: localInputToIso(String(data.get("starts_at"))),
      ends_at: date("ends_at"),
      meeting_at: date("meeting_at"),
      location: optional("location"),
      notes: optional("notes"),
      opponent: kind === "match" ? optional("opponent") : null,
      venue: kind === "match" ? (data.get("venue") as "home" | "away") : null,
    };
    const done = () => {
      setSaved(true);
      if (!existing) {
        form.reset();
        setKind("match");
        setRepeat(false);
      }
      onSuccess?.();
    };
    if (existing) {
      const fields = { ...body } as Partial<EventCreate>;
      delete fields.team_id;
      delete fields.kind;
      update.mutate(fields, { onSuccess: done });
    } else if (repeat)
      series.mutate(
        {
          ...body,
          repeat_until: String(data.get("repeat_until")),
          interval_weeks: Number(data.get("interval_weeks")),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        { onSuccess: done },
      );
    else create.mutate(body, { onSuccess: done });
  };
  return (
    <form
      onSubmit={submit}
      aria-label={existing ? "Modifier l’événement" : t("events.newEvent")}
      className="grid gap-4 sm:grid-cols-2"
    >
      <FormField label={t("events.kind")}>
        {(props) => (
          <NativeSelect
            {...props}
            name="kind"
            value={kind}
            disabled={!!existing}
            onChange={(e) => setKind(e.target.value as EventCreate["kind"])}
          >
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kinds.${value}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t("events.eventTitle")} error={fieldErrorFor(mutation.error, "title")}>
        {(props) => (
          <Input {...props} name="title" required maxLength={120} defaultValue={existing?.title} />
        )}
      </FormField>
      <FormField label={t("events.startsAt")} error={fieldErrorFor(mutation.error, "starts_at")}>
        {(props) => (
          <Input
            {...props}
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={inputDate(existing?.starts_at)}
          />
        )}
      </FormField>
      <FormField label="Fin" error={fieldErrorFor(mutation.error, "ends_at")}>
        {(props) => (
          <Input
            {...props}
            name="ends_at"
            type="datetime-local"
            defaultValue={inputDate(existing?.ends_at)}
          />
        )}
      </FormField>
      <FormField label={t("events.meetingAt")}>
        {(props) => (
          <Input
            {...props}
            name="meeting_at"
            type="datetime-local"
            defaultValue={inputDate(existing?.meeting_at)}
          />
        )}
      </FormField>
      <FormField label={t("events.location")}>
        {(props) => (
          <Input
            {...props}
            name="location"
            maxLength={200}
            defaultValue={existing?.location ?? ""}
          />
        )}
      </FormField>
      {kind === "match" && (
        <>
          <FormField label={t("events.opponent")} error={fieldErrorFor(mutation.error, "opponent")}>
            {(props) => (
              <Input
                {...props}
                name="opponent"
                required
                maxLength={100}
                defaultValue={existing?.opponent ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("events.venue")}>
            {(props) => (
              <NativeSelect {...props} name="venue" defaultValue={existing?.venue ?? "home"}>
                <option value="home">Domicile</option>
                <option value="away">Extérieur</option>
              </NativeSelect>
            )}
          </FormField>
        </>
      )}
      <div className="sm:col-span-2">
        <FormField label="Informations complémentaires">
          {(props) => (
            <textarea
              {...props}
              name="notes"
              rows={2}
              defaultValue={existing?.notes ?? ""}
              className="w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Matériel à apporter, accès au terrain…"
            />
          )}
        </FormField>
      </div>
      {!existing && (
        <div className="rounded-lg bg-muted/70 p-3 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Répéter cet événement
          </label>
          {repeat && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FormField label="Fréquence">
                {(props) => (
                  <NativeSelect {...props} name="interval_weeks">
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        Toutes les {n} semaine(s)
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField label="Jusqu’au">
                {(props) => <Input {...props} name="repeat_until" type="date" required />}
              </FormField>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={mutation.error} />
        {saved && (
          <p role="status" className="text-sm text-primary">
            Événement enregistré.
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {existing
            ? "Enregistrer les modifications"
            : repeat
              ? "Planifier la série"
              : t("events.schedule")}
        </Button>
      </div>
    </form>
  );
}
