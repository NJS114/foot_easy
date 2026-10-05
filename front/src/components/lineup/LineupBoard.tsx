import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Formation, Invitation, Lineup, Member } from "@/api/client";
import { LineupSaveBar, LineupSidebar } from "@/components/lineup/LineupSidebar";
import { Pitch } from "@/components/lineup/Pitch";
import { NativeSelect } from "@/components/ui/native-select";
import { useSaveLineup } from "@/hooks/useLineups";
import {
  assignStarter,
  assignSubstitute,
  fitToFormation,
  removePlayer,
  type Slots,
} from "@/lib/lineup";

type LineupBoardProps = {
  eventId: string;
  formations: Formation[];
  players: Member[];
  availability: Map<string, Invitation["availability"]>;
  lineup: Lineup | null;
};

function toSlots(lineup: Lineup | null): Slots {
  return (lineup?.slots ?? []).map((slot) => ({
    member_id: slot.member.id,
    role: slot.role,
    position_index: slot.position_index,
  }));
}

export function LineupBoard({
  eventId,
  formations,
  players,
  availability,
  lineup,
}: LineupBoardProps) {
  const { t } = useTranslation();
  const save = useSaveLineup(eventId);
  const [code, setCode] = useState(lineup?.formation ?? formations[0].code);
  const [slots, setSlots] = useState<Slots>(() => toSlots(lineup));
  const [isPublished, setIsPublished] = useState(lineup?.is_published ?? false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formation = formations.find((item) => item.code === code) ?? formations[0];
  const playersById = new Map(players.map((player) => [player.id, player]));
  const placed = new Set(slots.map((slot) => slot.member_id));

  const updateSlots = (next: Slots) => {
    setSlots(next);
    setSelectedId(null);
  };
  const handlePositionClick = (index: number, occupantId: string | null) => {
    if (selectedId) updateSlots(assignStarter(slots, selectedId, index));
    else if (occupantId) setSelectedId(occupantId);
  };
  const changeFormation = (nextCode: string) => {
    const next = formations.find((item) => item.code === nextCode);
    if (!next) return;
    setCode(nextCode);
    setSlots(fitToFormation(slots, next));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t("lineup.formation")}
          <NativeSelect
            value={code}
            onChange={(e) => changeFormation(e.target.value)}
            className="w-36"
          >
            {formations.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} ({item.players})
              </option>
            ))}
          </NativeSelect>
        </label>
        <Pitch
          formation={formation}
          slots={slots}
          players={playersById}
          selectedId={selectedId}
          onPositionClick={handlePositionClick}
        />
      </div>
      <div className="flex flex-col gap-4">
        <LineupSidebar
          unplaced={players.filter((player) => !placed.has(player.id))}
          bench={slots.filter((slot) => slot.role === "substitute")}
          playersById={playersById}
          availability={availability}
          selectedId={selectedId}
          onSelect={(memberId) => setSelectedId(selectedId === memberId ? null : memberId)}
          onBenchSelected={() => selectedId && updateSlots(assignSubstitute(slots, selectedId))}
          onRemove={(memberId) => updateSlots(removePlayer(slots, memberId))}
        />
        <LineupSaveBar
          isPublished={isPublished}
          onPublishedChange={setIsPublished}
          error={save.error}
          saved={save.data}
          isPending={save.isPending}
          onSave={() => save.mutate({ formation: code, is_published: isPublished, slots })}
        />
      </div>
    </div>
  );
}
