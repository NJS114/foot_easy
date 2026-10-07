import type { RouteObject } from "react-router-dom";
import { ClubGate } from "@/components/layout/ClubGate";
import { CalendarPage } from "@/pages/CalendarPage";
import { MessagingPage } from "@/workflows/Messaging";
import { CampaignsPage, CampaignDetailPage } from "@/workflows/Campaigns";
import { PaymentsPage, PaymentDetailPage } from "@/workflows/Payments";
import { SponsorsPage, SponsorDetailPage } from "@/workflows/Sponsors";
import { TasksPage } from "@/workflows/Tasks";
import { CompetitionsPage, CompetitionDetailPage } from "@/workflows/Competitions";
import { DocumentsPage, MemberDossierPage } from "@/workflows/Documents";
import { SettingsPage, InvitationsPage, StatisticsPage } from "@/workflows/Overview";
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
      { path: "/members/:memberId", element: <MemberDossierPage /> },
      { path: "/campaigns", element: <CampaignsPage /> },
      { path: "/campaigns/:campaignId", element: <CampaignDetailPage /> },
      { path: "/payments/:collectionId", element: <PaymentDetailPage /> },
      { path: "/sponsors/:sponsorId", element: <SponsorDetailPage /> },
      { path: "/tasks", element: <TasksPage /> },
      { path: "/documents", element: <DocumentsPage /> },
      { path: "/competitions", element: <CompetitionsPage /> },
      { path: "/competitions/:competitionId", element: <CompetitionDetailPage /> },
      { path: "/invitations", element: <InvitationsPage /> },
      { path: "/statistics", element: <StatisticsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/messaging", element: <MessagingPage /> },
      { path: "/payments", element: <PaymentsPage /> },
      { path: "/sponsors", element: <SponsorsPage /> },
    ],
  },
];
