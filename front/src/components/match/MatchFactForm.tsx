import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MatchFactCreate, Member } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateMatchFact } from "@/hooks/useMatchFacts";
import { fieldErrorFor } from "@/lib/formErrors";

type Kind = MatchFactCreate["kind"];
const KINDS: Kind[] = ["goal", "yellow_card", "red_card"];

function toFact(eventId: string, kind: Kind, data: FormData): MatchFactCreate {
  const assist = data.get("assist_member_id");
  const minute = data.get("minute");
  return {
    event_id: eventId,
    kind,
    member_id: String(data.get("member_id")),
    assist_member_id: kind === "goal" && assist ? String(assist) : null,
    minute: minute ? Number(minute) : null,
  };
}

export function MatchFactForm({ eventId, players }: { eventId: string; players: Member[] }) {
  const { t } = useTranslation();
  const createFact = useCreateMatchFact(eventId);
  const [kind, setKind] = useState<Kind>("goal");
  const options = players.map((player) => (
    <option key={player.id} value={player.id}>
      {player.shirt_number ? `${player.shirt_number}. ` : ""}
      {player.first_name} {player.last_name}
    </option>
  ));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createFact.mutate(toFact(eventId, kind, new FormData(event.currentTarget)));
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t("match.facts")}
      className="grid gap-3 sm:grid-cols-4"
    >
      <FormField label={t("match.kind")}>
        {(props) => (
          <NativeSelect {...props} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`match.factKinds.${value}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t("match.player")}>
        {(props) => (
          <NativeSelect {...props} name="member_id" required>
            {options}
          </NativeSelect>
        )}
      </FormField>
      {kind === "goal" && (
        <FormField label={t("match.assist")}>
          {(props) => (
            <NativeSelect {...props} name="assist_member_id" defaultValue="">
              <option value="">{t("match.noAssist")}</option>
              {options}
            </NativeSelect>
          )}
        </FormField>
      )}
      <FormField label={t("match.minute")} error={fieldErrorFor(createFact.error, "minute")}>
        {(props) => <Input {...props} name="minute" type="number" min={0} max={130} />}
      </FormField>
      <div className="flex flex-col gap-2 sm:col-span-4">
        <FormError error={createFact.error} />
        <Button type="submit" className="self-start" disabled={createFact.isPending}>
          {t("match.addFact")}
        </Button>
      </div>
    </form>
  );
}
