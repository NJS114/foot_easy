import type { RouteObject } from "react-router-dom";
import { ClubGate } from "@/components/layout/ClubGate";
import { CalendarPage } from "@/pages/CalendarPage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EventPage } from "@/pages/EventPage";
import { MembersPage } from "@/pages/MembersPage";
import { TeamPage } from "@/pages/TeamPage";
import { TeamsPage } from "@/pages/TeamsPage";

export const ROUTES: RouteObject[] = [
  {
    element: <ClubGate />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/calendar", element: <CalendarPage /> },
      { path: "/teams", element: <TeamsPage /> },
      { path: "/teams/:teamId", element: <TeamPage /> },
      { path: "/events/:eventId", element: <EventPage /> },
      { path: "/members", element: <MembersPage /> },
      { path: "/messaging", element: <ComingSoonPage module="messaging" /> },
      { path: "/payments", element: <ComingSoonPage module="payments" /> },
      { path: "/sponsors", element: <ComingSoonPage module="sponsors" /> },
    ],
  },
];
