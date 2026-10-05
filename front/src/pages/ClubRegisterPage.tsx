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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/15 to-background p-4">
      <Card className="w-full max-w-md">
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
    </main>
  );
}
