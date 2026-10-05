import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { EventCreate } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateEvent } from "@/hooks/useEvents";
import { fieldErrorFor } from "@/lib/formErrors";
import { localInputToIso } from "@/lib/dates";

type Kind = EventCreate["kind"];
type Venue = NonNullable<EventCreate["venue"]>;

const KINDS: Kind[] = ["match", "training", "other"];
const VENUES: Venue[] = ["home", "away"];

function toEventCreate(teamId: string, data: FormData): EventCreate {
  const kind = data.get("kind") as Kind;
  const optional = (key: string) => (data.get(key) ? String(data.get(key)) : null);
  const meetingAt = optional("meeting_at");
  return {
    team_id: teamId,
    kind,
    title: String(data.get("title")),
    starts_at: localInputToIso(String(data.get("starts_at"))),
    meeting_at: meetingAt ? localInputToIso(meetingAt) : null,
    location: optional("location"),
    opponent: kind === "match" ? optional("opponent") : null,
    venue: kind === "match" ? (optional("venue") as Venue | null) : null,
  };
}

export function EventCreateForm({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const createEvent = useCreateEvent();
  const [kind, setKind] = useState<Kind>("match");
  const error = createEvent.error;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    createEvent.mutate(toEventCreate(teamId, new FormData(form)), {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t("events.newEvent")}
      className="grid gap-3 sm:grid-cols-2"
    >
      <FormField label={t("events.kind")}>
        {(props) => (
          <NativeSelect
            {...props}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kinds.${value}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t("events.eventTitle")} error={fieldErrorFor(error, "title")}>
        {(props) => <Input {...props} name="title" required maxLength={120} />}
      </FormField>
      <FormField label={t("events.startsAt")} error={fieldErrorFor(error, "starts_at")}>
        {(props) => <Input {...props} name="starts_at" type="datetime-local" required />}
      </FormField>
      <FormField label={t("events.meetingAt")} error={fieldErrorFor(error, "meeting_at")}>
        {(props) => <Input {...props} name="meeting_at" type="datetime-local" />}
      </FormField>
      <FormField label={t("events.location")}>
        {(props) => <Input {...props} name="location" maxLength={200} />}
      </FormField>
      {kind === "match" && (
        <>
          <FormField label={t("events.opponent")} error={fieldErrorFor(error, "opponent")}>
            {(props) => <Input {...props} name="opponent" required maxLength={100} />}
          </FormField>
          <FormField label={t("events.venue")}>
            {(props) => (
              <NativeSelect {...props} name="venue" defaultValue="home">
                {VENUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`venues.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={error} />
        <Button type="submit" disabled={createEvent.isPending}>
          {t("events.schedule")}
        </Button>
      </div>
    </form>
  );
}
