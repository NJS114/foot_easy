import { useTranslation } from "react-i18next";
import type { Formation, Member } from "@/api/client";
import { pitchPositions, type Slots } from "@/lib/lineup";
import { cn } from "@/lib/utils";

type PitchProps = {
  formation: Formation;
  slots: Slots;
  players: Map<string, Member>;
  selectedId: string | null;
  onPositionClick: (positionIndex: number, occupantId: string | null) => void;
};

export function Pitch({ formation, slots, players, selectedId, onPositionClick }: PitchProps) {
  const { t } = useTranslation();
  const occupantAt = (index: number) =>
    slots.find((slot) => slot.role === "starter" && slot.position_index === index)?.member_id ??
    null;

  return (
    <div
      role="group"
      aria-label={t("lineup.pitch")}
      className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border-8 border-[#2f7250] bg-[repeating-linear-gradient(0deg,#428c61_0,#428c61_10%,#499667_10%,#499667_20%)] shadow-inner"
    >
      <div aria-hidden className="absolute inset-3 rounded-sm border-2 border-white/50" />
      <div
        aria-hidden
        className="absolute left-1/2 top-3 h-[14%] w-1/2 -translate-x-1/2 border-2 border-t-0 border-white/60"
      />
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 bg-white/70" />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70"
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-[14%] w-1/2 -translate-x-1/2 border-2 border-b-0 border-white/70"
      />
      {pitchPositions(formation).map(({ index, x, y }) => {
        const occupantId = occupantAt(index);
        const occupant = occupantId ? players.get(occupantId) : undefined;
        const label = occupant
          ? `${occupant.first_name} ${occupant.last_name}`
          : t("lineup.emptySlot", { index: index + 1 });
        return (
          <button
            key={index}
            type="button"
            aria-label={label}
            onClick={() => onPositionClick(index, occupantId)}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold shadow",
                occupant
                  ? "border-white bg-slate-900 text-white"
                  : "border-dashed border-white/80 text-white/80",
                occupantId && occupantId === selectedId && "ring-4 ring-amber-400",
              )}
            >
              {occupant ? (occupant.shirt_number ?? "•") : "+"}
            </span>
            {occupant && (
              <span className="max-w-full truncate rounded bg-black/50 px-1 text-[11px] text-white">
                {occupant.last_name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
