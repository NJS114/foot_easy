import { useTranslation } from "react-i18next";
import { useAvailabilitySummary } from "@/hooks/useInvitations";

export function AvailabilitySummaryBar({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { data } = useAvailabilitySummary(eventId);
  if (!data?.invited) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {t("invitations.summary", data)}
    </p>
  );
}
