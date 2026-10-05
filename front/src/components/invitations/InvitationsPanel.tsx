import { BellRing, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { FormError } from "@/components/FormField";
import { AvailabilitySummaryBar } from "@/components/invitations/AvailabilitySummaryBar";
import { InvitationList } from "@/components/invitations/InvitationList";
import { Button } from "@/components/ui/button";
import { useInviteRoster, useRemindPending } from "@/hooks/useInvitations";

export function InvitationsPanel({ event }: { event: Event }) {
  const { t } = useTranslation();
  const inviteRoster = useInviteRoster(event.id);
  const remind = useRemindPending(event.id);

  return (
    <div className="flex flex-col gap-3">
      {!event.is_cancelled && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={inviteRoster.isPending} onClick={() => inviteRoster.mutate()}>
            <Send aria-hidden />
            {t("invitations.inviteRoster")}
          </Button>
          <Button variant="outline" disabled={remind.isPending} onClick={() => remind.mutate()}>
            <BellRing aria-hidden />
            {t("invitations.remind")}
          </Button>
        </div>
      )}
      {remind.data && (
        <p role="status" className="text-sm text-primary">
          {t("invitations.reminded", { count: remind.data.reminded })}
        </p>
      )}
      <FormError error={inviteRoster.error ?? remind.error} />
      <AvailabilitySummaryBar eventId={event.id} />
      <InvitationList eventId={event.id} />
    </div>
  );
}
