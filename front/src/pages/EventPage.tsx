import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EventDetails } from "@/components/events/EventDetails";
import { InvitationsPanel } from "@/components/invitations/InvitationsPanel";
import { LineupEditor } from "@/components/lineup/LineupEditor";
import { MatchPanel } from "@/components/match/MatchPanel";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { EventTasksPanel } from "@/workflows/Tasks";
import { DocumentPanel } from "@/workflows/Documents";
import { Workspace } from "@/workflows/ui";
import { EventWorkflow } from "@/workflows/EventWorkflow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvent } from "@/hooks/useEvents";

export function EventPage() {
  const { t } = useTranslation();
  const { eventId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const initialTab = params.get("tab") || "invitations";
  const [tab, updateTab] = useState(
    ["invitations", "documents", "tasks", "lineup", "match"].includes(initialTab)
      ? initialTab
      : "invitations",
  );
  const setTab = (value: string) => {
    updateTab(value);
    setParams(
      (previous) => {
        previous.set("tab", value);
        return previous;
      },
      { replace: true },
    );
  };
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
      <EventWorkflow event={event} onTabChange={setTab} />
      <div className="flow-actions">
        <Link className="flow-link" to={`/messaging?eventId=${event.id}`}>
          Discussion de l’événement
        </Link>
        <Link className="flow-link" to={`/campaigns?eventId=${event.id}`}>
          Suivi des envois
        </Link>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invitations">{t("events.tabs.invitations")}</TabsTrigger>
          {isCompetitive && !event.is_cancelled && (
            <TabsTrigger value="lineup">{t("events.tabs.lineup")}</TabsTrigger>
          )}
          {isCompetitive && <TabsTrigger value="match">{t("events.tabs.match")}</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
        <TabsContent value="documents">
          <Workspace>
            {(data) => <DocumentPanel data={data} entityType="event" entityId={event.id} />}
          </Workspace>
        </TabsContent>
        <TabsContent value="tasks">
          <EventTasksPanel eventId={event.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
