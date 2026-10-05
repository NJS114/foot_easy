import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Megaphone,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
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

export function AppShell({ club }: { club: Club }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const active = NAV_ITEMS.find((item) =>
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to),
  );
  const initials = club.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      {menu && (
        <button
          className="nav-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={cn("app-sidebar", menu && "is-open")}>
        <Link to="/" className="brand" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            f<span>e</span>
          </span>
          <span>
            foot<span className="font-normal">easy</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <button className="mobile-close" onClick={() => setMenu(false)} aria-label="Fermer le menu">
          <X size={20} />
        </button>
        <div className="club-switch">
          <span className="club-crest" style={{ backgroundColor: club.primary_color }}>
            {initials}
          </span>
          <div className="min-w-0">
            <strong className="block truncate">{club.name}</strong>
            <span>{club.city || "Mon espace club"}</span>
          </div>
        </div>
        <p className="nav-caption">MON CLUB</p>
        <nav aria-label={t("nav.label")}>
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, soon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenu(false)}
              className={({ isActive }) => cn("nav-item", isActive && "active", soon && "nav-soon")}
            >
              <Icon size={19} />
              <span>{t(labelKey)}</span>
              {soon && <span className="soon-dot" title={t("common.soon")} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Trophy size={23} />
            <p>
              Moins de gestion.
              <br />
              <strong>Plus de terrain.</strong>
            </p>
          </div>
          <button className="nav-item w-full" onClick={() => setHelp(!help)} aria-expanded={help}>
            <CircleHelp size={19} />
            Bien démarrer
          </button>
          {help && (
            <p className="help-copy">
              Créez une équipe, ajoutez vos membres, puis planifiez un événement. Retrouvez les
              convocations, la composition et les tâches dans sa fiche.
            </p>
          )}
          <span className="sidebar-foot">FAIT POUR LE FOOT AMATEUR</span>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Ouvrir le menu"
              aria-expanded={menu}
            >
              <Menu size={22} />
            </button>
            <span className="hidden text-muted-foreground sm:inline">Espace club</span>
            <ChevronRight className="hidden text-muted-foreground sm:block" size={14} />
            <strong className="truncate text-sm">
              {active ? t(active.labelKey) : "Événement"}
            </strong>
          </div>
          <span className="topbar-club">
            <span className="status-dot" />
            {club.name}
          </span>
        </header>
        <main id="main-content" className="app-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Foot Easy · Le collectif avant tout.</span>
          <span>Votre club, au même endroit.</span>
        </footer>
      </div>
    </div>
  );
}
