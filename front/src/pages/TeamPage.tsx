import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { EventCreateForm } from "@/components/events/EventCreateForm";
import { EventList } from "@/components/events/EventList";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import { MemberList } from "@/components/members/MemberList";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { AttendanceGrid } from "@/components/stats/AttendanceGrid";
import { TaskBilan } from "@/components/stats/TaskBilan";
import { TeamStatsView } from "@/components/stats/TeamStatsView";
import { TaskCatalog } from "@/components/tasks/TaskCatalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentPanel } from "@/workflows/Documents";
import { Workspace } from "@/workflows/ui";
import { useTeam } from "@/hooks/useTeams";

export function TeamPage() {
  const { t } = useTranslation();
  const { teamId = "" } = useParams();
  const { data: team, isLoading, error } = useTeam(teamId);

  if (isLoading) return <LoadingState />;
  if (error || !team) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-6">
        <span aria-hidden className="size-4 rounded-full" style={{ backgroundColor: team.color }} />
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <Badge variant="secondary">{t(`categories.${team.category}`)}</Badge>
        <span className="text-muted-foreground">{team.season}</span>
      </header>
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">{t("teams.tabs.events")}</TabsTrigger>
          <TabsTrigger value="roster">{t("teams.tabs.roster")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("teams.tabs.attendance")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("teams.tabs.tasks")}</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="stats">{t("teams.tabs.stats")}</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="grid gap-6 xl:grid-cols-[1fr_24rem]">
          <EventList team={team} />
          <Card>
            <CardHeader>
              <CardTitle>{t("events.newEvent")}</CardTitle>
            </CardHeader>
            <CardContent>
              <EventCreateForm teamId={team.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roster" className="grid gap-6 xl:grid-cols-[1fr_24rem]">
          <MemberList teamId={team.id} />
          <Card>
            <CardHeader>
              <CardTitle>{t("members.newMember")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberCreateForm teamId={team.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceGrid teamId={team.id} />
        </TabsContent>
        <TabsContent value="tasks" className="flex flex-col gap-6">
          <TaskCatalog teamId={team.id} />
          <TaskBilan teamId={team.id} />
        </TabsContent>
        <TabsContent value="documents">
          <Workspace>
            {(data) => <DocumentPanel data={data} entityType="team" entityId={team.id} />}
          </Workspace>
        </TabsContent>
        <TabsContent value="stats">
          <TeamStatsView teamId={team.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
