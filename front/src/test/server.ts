import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Club, Event, Formation, Invitation, Member, Team } from "@/api/client";
import { API_BASE_URL } from "@/api/client";

export const apiUrl = (path: string) => `${API_BASE_URL}/api/v1${path}`;

export function page<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, has_more: false };
}

export const CLUB: Club = {
  id: "club-1",
  name: "AS Foot Easy",
  city: "Lyon",
  primary_color: "#16a34a",
  created_at: "2026-09-01T10:00:00Z",
};

export const TEAM: Team = {
  id: "team-1",
  club_id: CLUB.id,
  name: "FC Easy",
  category: "senior",
  season: "2026-2027",
  color: "#1d4ed8",
  created_at: "2026-09-01T10:00:00Z",
};

export const PLAYER: Member = {
  id: "member-1",
  team_id: TEAM.id,
  first_name: "Zinedine",
  last_name: "Zidane",
  email: null,
  role: "player",
  position: "midfielder",
  shirt_number: 10,
  created_at: "2026-09-01T10:00:00Z",
};

export const MATCH: Event = {
  id: "event-1",
  team_id: TEAM.id,
  kind: "match",
  title: "Championnat J1",
  starts_at: "2026-10-10T13:00:00Z",
  ends_at: null,
  meeting_at: null,
  location: "Stade municipal",
  opponent: "AS Rivale",
  venue: "home",
  notes: null,
  is_cancelled: false,
  score_for: null,
  score_against: null,
  created_at: "2026-09-01T10:00:00Z",
};

export const INVITATION: Invitation = {
  id: "invitation-1",
  event_id: MATCH.id,
  availability: "pending",
  comment: null,
  responded_at: null,
  reminder_count: 0,
  last_reminded_at: null,
  member: {
    id: PLAYER.id,
    first_name: PLAYER.first_name,
    last_name: PLAYER.last_name,
    role: PLAYER.role,
    position: PLAYER.position,
    shirt_number: PLAYER.shirt_number,
  },
};

export const FORMATIONS: Formation[] = [
  { code: "4-4-2", players: 11, lines: [4, 4, 2] },
  { code: "2-2", players: 5, lines: [2, 2] },
];

/** Every test runs inside an existing club unless it overrides this handler. */
export const server = setupServer(
  http.get(apiUrl("/clubs"), () => HttpResponse.json(page([CLUB]))),
);
