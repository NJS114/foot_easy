import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Event } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateEvent } from "@/hooks/useEvents";

export function ScoreForm({ event }: { event: Event }) {
  const { t } = useTranslation();
  const updateEvent = useUpdateEvent(event.id);

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    updateEvent.mutate({
      score_for: Number(data.get("score_for")),
      score_against: Number(data.get("score_against")),
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label={t("match.score")} className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <FormField label={t("match.us")}>
          {(props) => (
            <Input
              {...props}
              name="score_for"
              type="number"
              min={0}
              max={99}
              required
              defaultValue={event.score_for ?? ""}
              className="w-20 text-center text-2xl font-bold"
            />
          )}
        </FormField>
        <span className="pb-2 text-2xl font-bold">-</span>
        <FormField label={event.opponent ?? t("match.them")}>
          {(props) => (
            <Input
              {...props}
              name="score_against"
              type="number"
              min={0}
              max={99}
              required
              defaultValue={event.score_against ?? ""}
              className="w-20 text-center text-2xl font-bold"
            />
          )}
        </FormField>
        <Button type="submit" disabled={updateEvent.isPending}>
          {t("match.saveScore")}
        </Button>
      </div>
      <FormError error={updateEvent.error} />
    </form>
  );
}
