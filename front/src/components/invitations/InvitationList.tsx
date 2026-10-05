import { useTranslation } from "react-i18next";
import type { Invitation, InvitationReply } from "@/api/client";
import { AvailabilityBadge } from "@/components/invitations/AvailabilityBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { useInvitations, useReplyInvitation } from "@/hooks/useInvitations";

const REPLIES: InvitationReply["availability"][] = ["available", "uncertain", "unavailable"];

type InvitationRowProps = {
  invitation: Invitation;
  disabled: boolean;
  onReply: (availability: InvitationReply["availability"]) => void;
};

function InvitationRow({ invitation, disabled, onReply }: InvitationRowProps) {
  const { t } = useTranslation();
  const { member } = invitation;
  const fullName = `${member.first_name} ${member.last_name}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <span className="flex-1 font-medium">{fullName}</span>
      <AvailabilityBadge availability={invitation.availability} />
      <div
        role="group"
        aria-label={t("invitations.replyAs", { name: fullName })}
        className="flex gap-1"
      >
        {REPLIES.map((availability) => (
          <Button
            key={availability}
            size="sm"
            variant={invitation.availability === availability ? "default" : "outline"}
            aria-pressed={invitation.availability === availability}
            disabled={disabled}
            onClick={() => onReply(availability)}
          >
            {t(`availability.${availability}`)}
          </Button>
        ))}
      </div>
    </li>
  );
}

export function InvitationList({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useInvitations(eventId);
  const reply = useReplyInvitation(eventId);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("invitations.empty")} />;

  return (
    <ul className="divide-y rounded-md border">
      {data.items.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          invitation={invitation}
          disabled={reply.isPending}
          onReply={(availability) =>
            reply.mutate({ invitationId: invitation.id, body: { availability } })
          }
        />
      ))}
    </ul>
  );
}
