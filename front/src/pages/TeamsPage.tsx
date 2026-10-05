import { useTranslation } from "react-i18next";
import { TeamCreateForm } from "@/components/teams/TeamCreateForm";
import { TeamList } from "@/components/teams/TeamList";

export function TeamsPage() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("teams.title")}</h1>
          <p className="text-muted-foreground">{t("teams.subtitle")}</p>
        </div>
        <TeamList />
      </section>
      <TeamCreateForm />
    </div>
  );
}
