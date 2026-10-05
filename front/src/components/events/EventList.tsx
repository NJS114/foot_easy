import { useTranslation } from "react-i18next";
import type { Team } from "@/api/client";
import { EventRow } from "@/components/events/EventRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { useEvents } from "@/hooks/useEvents";

export function EventList({ team }: { team: Team }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useEvents(team.id);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("events.empty")} />;

  return (
    <ul className="divide-y rounded-md border">
      {data.items.map((event) => (
        <li key={event.id}>
          <EventRow event={event} team={team} />
        </li>
      ))}
    </ul>
  );
}
