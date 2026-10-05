import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { EventRow } from "@/components/events/EventRow";
import { FormField } from "@/components/FormField";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentClub } from "@/hooks/useClubs";
import { useTeamsEvents } from "@/hooks/useEvents";
import { useTeams } from "@/hooks/useTeams";

const KINDS: Event["kind"][] = ["match", "training", "tournament", "other"];

function groupByDay(events: Event[], locale: string): [string, Event[]][] {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const day = format.format(new Date(event.starts_at));
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups.entries()];
}

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const club = useCurrentClub();
  const teams = useTeams(club.id).data?.items ?? [];
  const [teamId, setTeamId] = useState("");
  const [kind, setKind] = useState("");
  const { events, isLoading, error } = useTeamsEvents(
    teamId ? [teamId] : teams.map((team) => team.id),
  );
  const filtered = events.filter((event) => !kind || event.kind === kind);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
      <div className="flex flex-wrap gap-4">
        <FormField label={t("calendar.filterTeam")}>
          {(props) => (
            <NativeSelect {...props} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={t("calendar.filterKind")}>
          {(props) => (
            <NativeSelect {...props} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`kinds.${value}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && !filtered.length && <EmptyState message={t("calendar.empty")} />}
      {groupByDay(filtered, i18n.language).map(([day, dayEvents]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">{day}</h2>
          <ul className="divide-y rounded-md border bg-card">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <EventRow event={event} team={teams.find((team) => team.id === event.team_id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
