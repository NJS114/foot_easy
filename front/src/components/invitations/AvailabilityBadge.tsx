import { useTranslation } from "react-i18next";
import type { Invitation } from "@/api/client";
import { Badge } from "@/components/ui/badge";

const VARIANTS = {
  pending: "outline",
  available: "success",
  uncertain: "warning",
  unavailable: "destructive",
} as const;

export function AvailabilityBadge({ availability }: { availability: Invitation["availability"] }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANTS[availability]}>{t(`availability.${availability}`)}</Badge>;
}
