import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Plus,
  Trophy,
  Users,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EventRow } from "@/components/events/EventRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { TeamList } from "@/components/teams/TeamList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentClub } from "@/hooks/useClubs";
import { useTeamsEvents } from "@/hooks/useEvents";
import { useClubMembers } from "@/hooks/useMembers";
import { useTeams } from "@/hooks/useTeams";

export function DashboardPage() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  const teamsQuery = useTeams(club.id);
  const teams = teamsQuery.data?.items ?? [];
  const members = useClubMembers(club.id);
  const { events, isLoading, error } = useTeamsEvents(teams.map((team) => team.id));
  const now = new Date();
  const upcoming = events.filter(
    (event) => new Date(event.starts_at) >= now && !event.is_cancelled,
  );
  const thisWeek = upcoming.filter(
    (event) => new Date(event.starts_at).getTime() < now.getTime() + 7 * 86400000,
  );
  const date = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const stats = [
    { label: "Membres du club", value: members.data?.total ?? "—", icon: Users },
    { label: "Équipes actives", value: teamsQuery.data?.total ?? "—", icon: Trophy },
    {
      label: "Événements cette semaine",
      value: isLoading || teamsQuery.isLoading ? "—" : thisWeek.length,
      icon: CalendarDays,
    },
    {
      label: "Matchs à venir",
      value:
        isLoading || teamsQuery.isLoading
          ? "—"
          : upcoming.filter((event) => event.kind === "match").length,
      icon: ClipboardCheck,
    },
  ];
  return (
    <div className="flex flex-col gap-7">
      <header className="page-heading">
        <div>
          <p className="mb-2 text-xs capitalize text-muted-foreground">{date}</p>
          <h1>{t("dashboard.welcome", { club: club.name })}</h1>
          <p className="page-subtitle">Toute la vie de votre club, en un coup d’œil.</p>
        </div>
        <Button asChild>
          <Link to="/calendar?create=1">
            <Plus />
            Créer un événement
          </Link>
        </Button>
      </header>
      <section className="dashboard-hero">
        <div className="hero-content">
          <span className="eyebrow">UNE ÉQUIPE. UN COLLECTIF.</span>
          <h2>
            Le club s’organise ici.
            <br />
            L’histoire s’écrit sur le terrain.
          </h2>
          <p>
            Calendrier, convocations et compositions : tout est prêt pour vous concentrer sur ce qui
            compte.
          </p>
          <Link
            to="/calendar"
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#91e5ab]"
          >
            Préparer les prochains rendez-vous <ArrowRight size={15} />
          </Link>
        </div>
        <div className="hero-pitch" aria-hidden>
          {[
            [50, 85],
            [20, 62],
            [80, 62],
            [50, 47],
            [23, 23],
            [76, 23],
          ].map(([x, y], i) => (
            <span key={i} className="pitch-player" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </div>
      </section>
      {(teamsQuery.error || members.error) && (
        <ErrorState error={teamsQuery.error || members.error} />
      )}
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
            <span className="stat-icon">
              <Icon size={20} />
            </span>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("dashboard.upcoming")}</CardTitle>
            <Link
              to="/calendar"
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              Tout le calendrier <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} />
            ) : !upcoming.length ? (
              <EmptyState message={t("dashboard.noUpcoming")} />
            ) : (
              <ul className="divide-y">
                {upcoming.slice(0, 4).map((event) => (
                  <li key={event.id}>
                    <EventRow
                      event={event}
                      team={teams.find((team) => team.id === event.team_id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Au cœur du club</CardTitle>
          </CardHeader>
          <CardContent>
            {[
              {
                to: "/members",
                icon: UserRound,
                title: "Votre annuaire",
                text: "Les bonnes informations, au même endroit.",
              },
              {
                to: "/teams",
                icon: Trophy,
                title: "La vie des équipes",
                text: "Effectifs, compositions et résultats.",
              },
              {
                to: "/calendar",
                icon: CalendarDays,
                title: "Le prochain rendez-vous",
                text: "Convoquez, préparez et suivez les présences.",
              },
            ].map(({ to, icon: Icon, title, text }) => (
              <Link key={to} to={to} className="feature-link">
                <span className="stat-icon">
                  <Icon size={18} />
                </span>
                <div className="flex-1">
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("dashboard.teams")}</h2>
          <Link to="/teams" className="text-xs text-primary">
            Gérer les équipes →
          </Link>
        </div>
        <TeamList />
      </section>
    </div>
  );
}
