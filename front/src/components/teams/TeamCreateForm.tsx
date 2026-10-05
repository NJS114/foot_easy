import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TeamCreate } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateTeam } from "@/hooks/useTeams";
import { fieldErrorFor } from "@/lib/formErrors";

const TEAM_CATEGORIES: TeamCreate["category"][] = [
  "u7",
  "u9",
  "u11",
  "u13",
  "u15",
  "u17",
  "u19",
  "senior",
  "veteran",
];

export function TeamCreateForm() {
  const { t } = useTranslation();
  const createTeam = useCreateTeam();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    createTeam.mutate(
      {
        name: String(data.get("name")),
        category: data.get("category") as TeamCreate["category"],
        season: String(data.get("season")),
      },
      { onSuccess: () => form.reset() },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("teams.newTeam")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label={t("teams.name")} error={fieldErrorFor(createTeam.error, "name")}>
            {(props) => <Input {...props} name="name" required maxLength={100} />}
          </FormField>
          <FormField label={t("teams.category")}>
            {(props) => (
              <NativeSelect {...props} name="category" defaultValue="senior">
                {TEAM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            label={t("teams.season")}
            hint={t("teams.seasonHint")}
            error={fieldErrorFor(createTeam.error, "season")}
          >
            {(props) => <Input {...props} name="season" required placeholder="2026-2027" />}
          </FormField>
          <FormError error={createTeam.error} />
          <Button type="submit" disabled={createTeam.isPending}>
            {t("teams.create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
