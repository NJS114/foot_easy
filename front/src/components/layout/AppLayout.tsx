import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";

export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Trophy aria-hidden className="size-5" />
            {t("app.name")}
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t("app.teams")}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
