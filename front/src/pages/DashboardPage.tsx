import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EventRow } from "@/components/events/EventRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { TeamList } from "@/components/teams/TeamList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentClub } from "@/hooks/useClubs";
import { useTeamsEvents } from "@/hooks/useEvents";
import { useTeams } from "@/hooks/useTeams";

const UPCOMING_LIMIT = 5;

function UpcomingEvents() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  const teams = useTeams(club.id).data?.items ?? [];
  const { events, isLoading, error } = useTeamsEvents(teams.map((team) => team.id));
  const now = new Date().toISOString();
  const upcoming = events
    .filter((event) => event.starts_at >= now && !event.is_cancelled)
    .slice(0, UPCOMING_LIMIT);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!upcoming.length) return <EmptyState message={t("dashboard.noUpcoming")} />;
  return (
    <ul className="divide-y rounded-md border">
      {upcoming.map((event) => (
        <li key={event.id}>
          <EventRow event={event} team={teams.find((team) => team.id === event.team_id)} />
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("dashboard.welcome", { club: club.name })}</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("dashboard.upcoming")}</CardTitle>
          <Link to="/calendar" className="text-sm text-primary hover:underline">
            {t("dashboard.seeAll")}
          </Link>
        </CardHeader>
        <CardContent>
          <UpcomingEvents />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("dashboard.teams")}</h2>
        <TeamList />
      </section>
    </div>
  );
}
