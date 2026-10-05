import { setupServer } from "msw/node";
import type { Event, Invitation, Member, Team } from "@/api/client";
import { API_BASE_URL } from "@/api/client";

export const server = setupServer();

export const apiUrl = (path: string) => `${API_BASE_URL}/api/v1${path}`;

export function page<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, has_more: false };
}

export const TEAM: Team = {
  id: "team-1",
  name: "FC Easy",
  category: "senior",
  season: "2026-2027",
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
  created_at: "2026-09-01T10:00:00Z",
};

export const INVITATION: Invitation = {
  id: "invitation-1",
  event_id: MATCH.id,
  availability: "pending",
  comment: null,
  responded_at: null,
  member: {
    id: PLAYER.id,
    first_name: PLAYER.first_name,
    last_name: PLAYER.last_name,
    role: PLAYER.role,
    position: PLAYER.position,
    shirt_number: PLAYER.shirt_number,
  },
};
