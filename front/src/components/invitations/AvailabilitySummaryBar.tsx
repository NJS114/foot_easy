import { Check, Clock, HelpCircle, X } from "lucide-react";
import { useAvailabilitySummary } from "@/hooks/useInvitations";
export function AvailabilitySummaryBar({ eventId }: { eventId: string }) {
  const { data } = useAvailabilitySummary(eventId);
  if (!data?.invited) return null;
  const cards = [
    {
      key: "available" as const,
      label: "Disponibles",
      icon: Check,
      color: "#358b51",
      bg: "#edf8ef",
    },
    { key: "pending" as const, label: "En attente", icon: Clock, color: "#a38b31", bg: "#fff9e7" },
    {
      key: "uncertain" as const,
      label: "Incertains",
      icon: HelpCircle,
      color: "#b67f31",
      bg: "#fff3e7",
    },
    { key: "unavailable" as const, label: "Absents", icon: X, color: "#c45f61", bg: "#fff0f0" },
  ];
  return (
    <div
      className="my-3 grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Disponibilités des membres"
    >
      {cards.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border p-4"
          style={{ background: bg, borderColor: `${color}20` }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-full"
            style={{ background: `${color}15`, color }}
          >
            <Icon size={16} />
          </span>
          <div>
            <strong className="text-xl" style={{ color }}>
              {data[key]}
            </strong>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
