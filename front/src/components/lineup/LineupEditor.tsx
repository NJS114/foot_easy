import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { LineupBoard } from "@/components/lineup/LineupBoard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { useInvitations } from "@/hooks/useInvitations";
import { useFormations, useLineup } from "@/hooks/useLineups";
import { useMembers } from "@/hooks/useMembers";

/** Loads everything the lineup board needs; the board then owns the edits locally. */
export function LineupEditor({ event }: { event: Event }) {
  const { t } = useTranslation();
  const formations = useFormations();
  const lineup = useLineup(event.id);
  const members = useMembers(event.team_id);
  const invitations = useInvitations(event.id);
  const queries = [formations, lineup, members, invitations];

  if (queries.some((query) => query.isLoading)) return <LoadingState />;
  const error = queries.find((query) => query.error)?.error;
  if (error) return <ErrorState error={error} />;

  const players = (members.data?.items ?? []).filter((member) => member.role === "player");
  if (!players.length) return <EmptyState message={t("lineup.noPlayers")} />;
  const availability = new Map(
    (invitations.data?.items ?? []).map((invitation) => [
      invitation.member.id,
      invitation.availability,
    ]),
  );

  return (
    <LineupBoard
      eventId={event.id}
      formations={formations.data ?? []}
      players={players}
      availability={availability}
      lineup={lineup.data ?? null}
    />
  );
}
