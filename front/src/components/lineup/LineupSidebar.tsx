import { useTranslation } from "react-i18next";
import type { Invitation, Lineup, Member } from "@/api/client";
import { FormError } from "@/components/FormField";
import { PlayerChip } from "@/components/lineup/PlayerPicker";
import { Button } from "@/components/ui/button";
import type { Slots } from "@/lib/lineup";

type LineupSidebarProps = {
  unplaced: Member[];
  bench: Slots;
  playersById: Map<string, Member>;
  availability: Map<string, Invitation["availability"]>;
  selectedId: string | null;
  onSelect: (memberId: string) => void;
  onBenchSelected: () => void;
  onRemove: (memberId: string) => void;
};

export function LineupSidebar(props: LineupSidebarProps) {
  const { t } = useTranslation();
  const { unplaced, bench, playersById, availability, selectedId, onSelect } = props;
  return (
    <>
      <p className="text-sm text-muted-foreground">{t("lineup.pickHint")}</p>
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("lineup.available")}</h3>
        <ul className="flex flex-col gap-1">
          {unplaced.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              availability={availability.get(player.id)}
              selected={selectedId === player.id}
              onSelect={() => onSelect(player.id)}
            />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("lineup.bench")}</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedId}
            onClick={props.onBenchSelected}
          >
            {t("lineup.toBench")}
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {bench.map(({ member_id: memberId }) => {
            const player = playersById.get(memberId);
            if (!player) return null;
            return (
              <PlayerChip
                key={memberId}
                player={player}
                availability={availability.get(memberId)}
                selected={selectedId === memberId}
                onSelect={() => onSelect(memberId)}
                onRemove={() => props.onRemove(memberId)}
              />
            );
          })}
        </ul>
      </section>
    </>
  );
}

type SaveBarProps = {
  isPublished: boolean;
  onPublishedChange: (value: boolean) => void;
  error: Error | null;
  saved: Lineup | undefined;
  isPending: boolean;
  onSave: () => void;
};

export function LineupSaveBar(props: SaveBarProps) {
  const { t } = useTranslation();
  const unavailable = props.saved?.unavailable_member_ids.length ?? 0;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.isPublished}
          onChange={(e) => props.onPublishedChange(e.target.checked)}
        />
        {t("lineup.publish")}
      </label>
      {props.isPublished && (
        <p className="text-sm text-muted-foreground">
          L’enregistrement partage la composition avec les titulaires et remplaçants par email
          simulé. Retrouvez les statuts dans le suivi des envois.
        </p>
      )}
      <FormError error={props.error} />
      {props.saved && (
        <p role="status" className="text-sm text-primary">
          {t("lineup.saved")}
          {unavailable > 0 && ` · ${t("lineup.notAvailable", { count: unavailable })}`}
        </p>
      )}
      <Button className="self-start" disabled={props.isPending} onClick={props.onSave}>
        {t("common.save")}
      </Button>
    </>
  );
}
