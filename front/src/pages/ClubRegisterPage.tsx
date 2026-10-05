import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCreateClub } from "@/hooks/useClubs";
import { fieldErrorFor } from "@/lib/formErrors";

export function ClubRegisterPage() {
  const { t } = useTranslation();
  const createClub = useCreateClub();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createClub.mutate({
      name: String(data.get("name")),
      city: data.get("city") ? String(data.get("city")) : null,
      primary_color: String(data.get("primary_color")),
    });
  };

  return (
    <main className="registration">
      <section className="registration-story">
        <span className="eyebrow">FOOT EASY · LA VIE DU CLUB, SIMPLIFIÉE</span>
        <h1>
          Un seul espace.
          <br />
          Tout votre club.
          <br />
          <span>Plus de football.</span>
        </h1>
        <p>
          Réunissez vos membres, préparez les matchs et accompagnez vos équipes tout au long de la
          saison.
        </p>
        <div className="mt-10 flex flex-wrap gap-5 text-xs text-[#8dddab]">
          <span>✓ Calendrier partagé</span>
          <span>✓ Convocations</span>
          <span>✓ Compositions</span>
        </div>
      </section>
      <section className="registration-form">
        <div>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl">{t("club.registerTitle")}</CardTitle>
              <CardDescription>{t("club.registerIntro")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormField label={t("club.name")} error={fieldErrorFor(createClub.error, "name")}>
                  {(props) => <Input {...props} name="name" required maxLength={120} />}
                </FormField>
                <FormField label={t("club.city")}>
                  {(props) => <Input {...props} name="city" maxLength={120} />}
                </FormField>
                <FormField label={t("club.color")}>
                  {(props) => (
                    <Input {...props} name="primary_color" type="color" defaultValue="#16a34a" />
                  )}
                </FormField>
                <FormError error={createClub.error} />
                <Button type="submit" size="lg" disabled={createClub.isPending}>
                  {t("club.register")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
