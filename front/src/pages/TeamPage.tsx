import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { EventCreateForm } from "@/components/events/EventCreateForm";
import { EventList } from "@/components/events/EventList";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import { MemberList } from "@/components/members/MemberList";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeam } from "@/hooks/useTeams";

export function TeamPage() {
  const { t } = useTranslation();
  const { teamId = "" } = useParams();
  const { data: team, isLoading, error } = useTeam(teamId);

  if (isLoading) return <LoadingState />;
  if (error || !team) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <Badge variant="secondary">{t(`categories.${team.category}`)}</Badge>
        <span className="text-muted-foreground">{team.season}</span>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("events.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <EventList teamId={team.id} />
            <EventCreateForm teamId={team.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("members.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <MemberList teamId={team.id} />
            <MemberCreateForm teamId={team.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
