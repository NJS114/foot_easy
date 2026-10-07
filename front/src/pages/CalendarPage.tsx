import { SponsorBanner } from "@/workflows/Sponsors";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import type { Event } from "@/api/client";
import { EventCreateForm } from "@/components/events/EventCreateForm";
import { EventRow } from "@/components/events/EventRow";
import { FormField } from "@/components/FormField";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentClub } from "@/hooks/useClubs";
import { useTeamsEvents } from "@/hooks/useEvents";
import { useTeams } from "@/hooks/useTeams";
import { dateKey, exportCalendar, monthDays } from "@/lib/calendar";
import { cn } from "@/lib/utils";
const KINDS: Event["kind"][] = ["match", "training", "tournament", "other"];
export function CalendarPage() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  const teamsQuery = useTeams(club.id);
  const teams = teamsQuery.data?.items ?? [];
  const [teamId, setTeamId] = useState("");
  const [kind, setKind] = useState("");
  const [view, setView] = useState<"month" | "list">("month");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [params, setParams] = useSearchParams();
  const [createTeam, setCreateTeam] = useState("");
  const { events, isLoading, error } = useTeamsEvents(
    teamId ? [teamId] : teams.map((team) => team.id),
  );
  const filtered = events.filter((event) => !kind || event.kind === kind);
  const days = monthDays(month),
    today = dateKey(new Date());
  const close = () => setParams({});
  const shift = (direction: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  const groups = new Map<string, Event[]>();
  for (const event of filtered) {
    const key = dateKey(new Date(event.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return (
    <div className="flex flex-col gap-6">
      <SponsorBanner surface="calendar" />
      <header className="page-heading">
        <div>
          <h1>{t("calendar.title")}</h1>
          <p className="page-subtitle">Les rendez-vous qui font vivre votre collectif.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportCalendar(filtered)}
            disabled={!filtered.length}
          >
            <Download />
            Exporter .ics
          </Button>
          <Button onClick={() => setParams({ create: "1" })}>
            <Plus />
            Nouvel événement
          </Button>
        </div>
      </header>
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b p-5">
          <div className="flex flex-wrap gap-3">
            <FormField label={t("calendar.filterTeam")}>
              {(props) => (
                <NativeSelect {...props} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Toutes les équipes</option>
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
                  <option value="">Tous les événements</option>
                  {KINDS.map((value) => (
                    <option key={value} value={value}>
                      {t(`kinds.${value}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <div className="flex rounded-lg border p-1">
            <Button
              size="sm"
              variant={view === "month" ? "secondary" : "ghost"}
              aria-pressed={view === "month"}
              onClick={() => setView("month")}
            >
              <CalendarDays />
              Mois
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List />
              Agenda
            </Button>
          </div>
        </div>
        {teamsQuery.isLoading || isLoading ? (
          <LoadingState />
        ) : teamsQuery.error || error ? (
          <ErrorState error={teamsQuery.error || error} />
        ) : (
          <>
            {view === "month" ? (
              <>
                <div className="flex items-center justify-between gap-3 p-5">
                  <h2 className="text-lg font-semibold capitalize">
                    {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                      }
                    >
                      Aujourd’hui
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mois précédent"
                      onClick={() => shift(-1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mois suivant"
                      onClick={() => shift(1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
                <div className="calendar-grid border-t">
                  {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((day) => (
                    <div
                      key={day}
                      className="border-b bg-muted/60 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                  {days.map((day) => {
                    const key = dateKey(day);
                    return (
                      <div
                        key={key}
                        className={cn(
                          "calendar-cell",
                          day.getMonth() !== month.getMonth() && "outside",
                        )}
                      >
                        <span className={cn("calendar-date", key === today && "today")}>
                          {day.getDate()}
                        </span>
                        {(groups.get(key) ?? []).map((event) => (
                          <Link
                            key={event.id}
                            to={`/events/${event.id}`}
                            className={cn(
                              "calendar-event",
                              `event-${event.kind}`,
                              event.is_cancelled && "line-through opacity-50",
                            )}
                            title={`${event.title} · ${teams.find((team) => team.id === event.team_id)?.name ?? ""}`}
                          >
                            <span className="font-semibold">
                              {new Date(event.starts_at).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="block truncate">{event.title}</span>
                            <span className="hidden truncate opacity-70 lg:block">
                              {teams.find((team) => team.id === event.team_id)?.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-5">
                {!filtered.length && <EmptyState message={t("calendar.empty")} />}{" "}
                {[...groups].map(([key, dayEvents]) => (
                  <section key={key} className="mb-6">
                    <h2 className="mb-2 text-xs font-semibold capitalize text-muted-foreground">
                      {new Date(`${key}T12:00:00`).toLocaleDateString("fr-FR", {
                        dateStyle: "full",
                      })}
                    </h2>
                    <ul className="divide-y">
                      {dayEvents.map((event) => (
                        <li key={event.id}>
                          <EventRow
                            event={event}
                            team={teams.find((team) => team.id === event.team_id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-5 p-5 text-xs text-muted-foreground">
          {KINDS.map((kind) => (
            <span key={kind} className="flex items-center gap-2">
              <span className={`size-2 rounded-full border-2 event-${kind}`} />
              {t(`kinds.${kind}`)}
            </span>
          ))}
          <span className="ml-auto">{filtered.length} événement(s)</span>
        </div>
      </div>
      {params.has("create") && (
        <Modal title="Nouvel événement" onClose={close}>
          {teamsQuery.isLoading ? (
            <LoadingState />
          ) : teamsQuery.error ? (
            <ErrorState error={teamsQuery.error} />
          ) : !teams.length ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                Créez une première équipe pour planifier vos rendez-vous.
              </p>
              <Button asChild>
                <Link to="/teams">Créer une équipe</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <FormField label="Équipe concernée">
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={createTeam || teamId || teams[0].id}
                      onChange={(e) => setCreateTeam(e.target.value)}
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              </div>
              <EventCreateForm
                key={createTeam || teamId || teams[0].id}
                teamId={createTeam || teamId || teams[0].id}
                onSuccess={close}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
