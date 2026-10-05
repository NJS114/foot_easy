import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Event, MatchFact } from "@/api/client";
import { MatchFactForm } from "@/components/match/MatchFactForm";
import { ScoreForm } from "@/components/match/ScoreForm";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { useDeleteMatchFact, useMatchFacts } from "@/hooks/useMatchFacts";
import { useMembers } from "@/hooks/useMembers";

const FACT_ICONS: Record<MatchFact["kind"], string> = {
  goal: "⚽",
  yellow_card: "🟨",
  red_card: "🟥",
};

function FactRow({ fact, onDelete }: { fact: MatchFact; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="w-10 font-mono text-sm text-muted-foreground">
        {fact.minute != null ? `${fact.minute}'` : ""}
      </span>
      <span aria-hidden>{FACT_ICONS[fact.kind]}</span>
      <span className="sr-only">{t(`match.factKinds.${fact.kind}`)}</span>
      <span className="flex-1 font-medium">
        {fact.member.first_name} {fact.member.last_name}
        {fact.assist_member && (
          <span className="font-normal text-muted-foreground">
            {" "}
            ({t("match.assist")} : {fact.assist_member.last_name})
          </span>
        )}
      </span>
      <Button variant="ghost" size="icon" aria-label={t("match.deleteFact")} onClick={onDelete}>
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

export function MatchPanel({ event }: { event: Event }) {
  const { t } = useTranslation();
  const facts = useMatchFacts(event.id);
  const deleteFact = useDeleteMatchFact(event.id);
  const players = (useMembers(event.team_id).data?.items ?? []).filter(
    (member) => member.role === "player",
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t("match.score")}</h3>
        <ScoreForm event={event} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">{t("match.facts")}</h3>
        {facts.isLoading && <LoadingState />}
        {facts.error && <ErrorState error={facts.error} />}
        {facts.data && !facts.data.items.length && <EmptyState message={t("match.noFacts")} />}
        {!!facts.data?.items.length && (
          <ul className="divide-y rounded-md border bg-card">
            {facts.data.items.map((fact) => (
              <FactRow key={fact.id} fact={fact} onDelete={() => deleteFact.mutate(fact.id)} />
            ))}
          </ul>
        )}
        {players.length > 0 && <MatchFactForm eventId={event.id} players={players} />}
      </section>
    </div>
  );
}
