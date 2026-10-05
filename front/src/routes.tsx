import type { RouteObject } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EventPage } from "@/pages/EventPage";
import { TeamPage } from "@/pages/TeamPage";
import { TeamsPage } from "@/pages/TeamsPage";

export const ROUTES: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <TeamsPage /> },
      { path: "/teams/:teamId", element: <TeamPage /> },
      { path: "/events/:eventId", element: <EventPage /> },
    ],
  },
];
