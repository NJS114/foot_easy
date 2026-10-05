import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Module = "members" | "messaging" | "payments" | "sponsors";

const TITLE_KEYS: Record<Module, string> = {
  members: "nav.members",
  messaging: "nav.messaging",
  payments: "nav.payments",
  sponsors: "nav.sponsors",
};

export function ComingSoonPage({ module }: { module: Module }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t(TITLE_KEYS[module])}</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction aria-hidden className="size-5 text-primary" />
            {t("comingSoon.title")}
          </CardTitle>
          <CardDescription>{t("comingSoon.intro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>{t(`comingSoon.${module}`)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
