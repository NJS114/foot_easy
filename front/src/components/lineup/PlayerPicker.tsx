import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Invitation, Member } from "@/api/client";
import { AvailabilityBadge } from "@/components/invitations/AvailabilityBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlayerChipProps = {
  player: Member;
  availability?: Invitation["availability"];
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
};

export function PlayerChip({
  player,
  availability,
  selected,
  onSelect,
  onRemove,
}: PlayerChipProps) {
  const { t } = useTranslation();
  const name = `${player.first_name} ${player.last_name}`;
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card px-2 py-1",
        selected && "border-amber-400 ring-2 ring-amber-400",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 text-left text-sm"
      >
        <span className="w-6 text-center font-mono text-muted-foreground">
          {player.shirt_number ?? ""}
        </span>
        <span className="flex-1 font-medium">{name}</span>
      </button>
      {availability && <AvailabilityBadge availability={availability} />}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("lineup.remove", { name })}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      )}
    </li>
  );
}
