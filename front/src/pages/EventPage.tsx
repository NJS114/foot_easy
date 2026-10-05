import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { EventDetails } from "@/components/events/EventDetails";
import { InvitationsPanel } from "@/components/invitations/InvitationsPanel";
import { LineupEditor } from "@/components/lineup/LineupEditor";
import { MatchPanel } from "@/components/match/MatchPanel";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { TaskAssigner } from "@/components/tasks/TaskManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvent } from "@/hooks/useEvents";

export function EventPage() {
  const { t } = useTranslation();
  const { eventId = "" } = useParams();
  const { data: event, isLoading, error } = useEvent(eventId);

  if (isLoading) return <LoadingState />;
  if (error || !event) return <ErrorState error={error} />;
  const isCompetitive = event.kind === "match" || event.kind === "tournament";

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={`/teams/${event.team_id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("common.back")}
      </Link>
      <EventDetails event={event} />
      <Tabs defaultValue="invitations">
        <TabsList>
          <TabsTrigger value="invitations">{t("events.tabs.invitations")}</TabsTrigger>
          {isCompetitive && !event.is_cancelled && (
            <TabsTrigger value="lineup">{t("events.tabs.lineup")}</TabsTrigger>
          )}
          {isCompetitive && <TabsTrigger value="match">{t("events.tabs.match")}</TabsTrigger>}
          <TabsTrigger value="tasks">{t("events.tabs.tasks")}</TabsTrigger>
        </TabsList>
        <TabsContent value="invitations">
          <InvitationsPanel event={event} />
        </TabsContent>
        {isCompetitive && !event.is_cancelled && (
          <TabsContent value="lineup">
            <LineupEditor event={event} />
          </TabsContent>
        )}
        {isCompetitive && (
          <TabsContent value="match">
            <MatchPanel event={event} />
          </TabsContent>
        )}
        <TabsContent value="tasks">
          <TaskAssigner eventId={event.id} teamId={event.team_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
