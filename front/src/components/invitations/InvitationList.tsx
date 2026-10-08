import { FormError } from "@/components/FormField";
import { NativeSelect } from "@/components/ui/native-select";
import { useTranslation } from "react-i18next";
import type { Invitation, InvitationReply } from "@/api/client";
import { AvailabilityBadge } from "@/components/invitations/AvailabilityBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { useInvitations, useReplyInvitation, useRecordAttendance } from "@/hooks/useInvitations";

const REPLIES: InvitationReply["availability"][] = ["available", "uncertain", "unavailable"];

type InvitationRowProps = {
  invitation: Invitation;
  disabled: boolean;
  onAttendance: (attendance: Invitation["attendance"]) => void;
  onReply: (availability: InvitationReply["availability"]) => void;
};

function InvitationRow({ invitation, disabled, onReply, onAttendance }: InvitationRowProps) {
  const { t } = useTranslation();
  const { member } = invitation;
  const fullName = `${member.first_name} ${member.last_name}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-4">
      <span className="member-avatar">
        {member.first_name[0]}
        {member.last_name[0]}
      </span>
      <span className="min-w-32 flex-1 text-sm font-medium">{fullName}</span>
      {invitation.availability === "pending" && invitation.reminder_count > 0 && (
        <span className="text-xs text-muted-foreground">
          {t("invitations.reminderCount", { count: invitation.reminder_count })}
        </span>
      )}
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
      <NativeSelect
        aria-label={`Présence réelle de ${fullName}`}
        value={invitation.attendance ?? ""}
        disabled={disabled}
        onChange={(e) => onAttendance((e.target.value || null) as Invitation["attendance"])}
      >
        <option value="">Présence à relever</option>
        {(["on_time", "late", "excused", "unexcused", "injured"] as const).map((status) => (
          <option key={status} value={status}>
            {t(`attendance.${status}`)}
          </option>
        ))}
      </NativeSelect>
    </li>
  );
}

export function InvitationList({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useInvitations(eventId);
  const reply = useReplyInvitation(eventId);
  const attendance = useRecordAttendance(eventId);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("invitations.empty")} />;

  return (
    <div>
      <FormError error={reply.error || attendance.error} />
      <ul className="divide-y rounded-xl border bg-card">
        {data.items.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            disabled={reply.isPending || attendance.isPending}
            onAttendance={(value) =>
              attendance.mutate({ invitationId: invitation.id, attendance: value })
            }
            onReply={(availability) =>
              reply.mutate({ invitationId: invitation.id, body: { availability } })
            }
          />
        ))}
      </ul>
    </div>
  );
}
