import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { EventDetails } from "@/components/events/EventDetails";
import { AvailabilitySummaryBar } from "@/components/invitations/AvailabilitySummaryBar";
import { InvitationList } from "@/components/invitations/InvitationList";
import { FormError } from "@/components/FormField";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvent } from "@/hooks/useEvents";
import { useInviteRoster } from "@/hooks/useInvitations";

export function EventPage() {
  const { t } = useTranslation();
  const { eventId = "" } = useParams();
  const { data: event, isLoading, error } = useEvent(eventId);
  const inviteRoster = useInviteRoster(eventId);

  if (isLoading) return <LoadingState />;
  if (error || !event) return <ErrorState error={error} />;

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
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("invitations.title")}</CardTitle>
          {!event.is_cancelled && (
            <Button disabled={inviteRoster.isPending} onClick={() => inviteRoster.mutate()}>
              {t("invitations.inviteRoster")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FormError error={inviteRoster.error} />
          <AvailabilitySummaryBar eventId={event.id} />
          <InvitationList eventId={event.id} />
        </CardContent>
      </Card>
    </div>
  );
}
