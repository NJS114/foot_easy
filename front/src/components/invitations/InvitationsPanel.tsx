import { BellRing, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { FormError } from "@/components/FormField";
import { AvailabilitySummaryBar } from "@/components/invitations/AvailabilitySummaryBar";
import { InvitationList } from "@/components/invitations/InvitationList";
import { ConfirmButton } from "@/workflows/ui";
import { useInviteRoster, useRemindPending } from "@/hooks/useInvitations";

export function InvitationsPanel({ event }: { event: Event }) {
  const { t } = useTranslation();
  const inviteRoster = useInviteRoster(event.id);
  const remind = useRemindPending(event.id);

  return (
    <div className="flex flex-col gap-3">
      {!event.is_cancelled && (
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            variant="default"
            pending={inviteRoster.isPending}
            label={
              <>
                <Send aria-hidden />
                {t("invitations.inviteRoster")}
              </>
            }
            title="Confirmer les convocations ?"
            onConfirm={() => inviteRoster.mutateAsync()}
          >
            Les membres qui ne sont pas encore convoqués seront ajoutés. Un email simulé sera suivi
            pour chacun dans Campagnes & envois ; les convocations existantes ne seront pas
            renvoyées.
          </ConfirmButton>
          <ConfirmButton
            pending={remind.isPending}
            label={
              <>
                <BellRing aria-hidden />
                {t("invitations.remind")}
              </>
            }
            title="Relancer les réponses attendues ?"
            onConfirm={() => remind.mutateAsync()}
          >
            Seuls les membres sans réponse recevront une relance simulée. Vous pourrez suivre sa
            distribution et traiter les échecs dans Campagnes & envois.
          </ConfirmButton>
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
