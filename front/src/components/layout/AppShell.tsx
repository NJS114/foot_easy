import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import type { Club } from "@/api/client";
import { cn } from "@/lib/utils";

type NavItem = { to: string; labelKey: string; icon: LucideIcon; soon?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { to: "/teams", labelKey: "nav.sport", icon: Trophy },
  { to: "/members", labelKey: "nav.members", icon: Users },
  { to: "/messaging", labelKey: "nav.messaging", icon: MessagesSquare, soon: true },
  { to: "/payments", labelKey: "nav.payments", icon: CreditCard, soon: true },
  { to: "/sponsors", labelKey: "nav.sponsors", icon: Megaphone, soon: true },
];

function ClubBadge({ club }: { club: Club }) {
  const initials = club.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 px-3 py-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: club.primary_color }}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{club.name}</p>
        {club.city && <p className="truncate text-xs text-white/60">{club.city}</p>}
      </div>
    </div>
  );
}

function SideNav() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon, soon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white",
                isActive && "bg-primary text-white hover:bg-primary",
              )
            }
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{t(labelKey)}</span>
            {soon && (
              <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase">
                {t("common.soon")}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ club }: { club: Club }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-slate-900 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0">
        <ClubBadge club={club} />
        <nav aria-label={t("nav.label")} className="pb-4">
          <SideNav />
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
