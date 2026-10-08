import type {
  Club,
  Team,
  Member,
  Event,
  Invitation,
  TeamTaskResponse,
  AssignmentResponse,
  Lineup,
  MatchFact,
  Formation,
} from "@/api/client";

export const stamp = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
const day = (offset: number, hour = 19) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};
export const formations: Formation[] = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "3-3-1",
  "2-3-2",
  "2-2",
].map((code) => {
  const lines = code.split("-").map(Number);
  return { code, lines, players: lines.reduce((a, b) => a + b, 1) };
});
export const clubs: Club[] = [
  {
    id: "club-olympique",
    name: "Olympique de Lyon Sud",
    city: "Lyon",
    primary_color: "#16a34a",
    created_at: stamp(),
  },
];
export const teams: Team[] = [
  {
    id: "seniors-a",
    club_id: clubs[0].id,
    name: "Seniors A",
    category: "senior",
    season: "2026-2027",
    color: "#16a34a",
    created_at: stamp(),
  },
  {
    id: "u17",
    club_id: clubs[0].id,
    name: "U17",
    category: "u17",
    season: "2026-2027",
    color: "#2563eb",
    created_at: stamp(),
  },
  {
    id: "u15-feminines",
    club_id: clubs[0].id,
    name: "U15 Féminines",
    category: "u15",
    season: "2026-2027",
    color: "#9333ea",
    created_at: stamp(),
  },
];
export const memberDefaults = {
  email: null,
  phone: null,
  birth_date: null,
  license_number: null,
  jersey_size: null,
  position: null,
  shirt_number: null,
  role: "player" as const,
};
const names = [
  [
    "Lucas Martin",
    "Hugo Bernard",
    "Adam Petit",
    "Louis Robert",
    "Noah Richard",
    "Gabriel Durand",
    "Nathan Moreau",
    "Ethan Laurent",
    "Raphaël Simon",
    "Mohamed Michel",
    "Léo Lefebvre",
    "Sacha Leroy",
    "Arthur Roux",
    "Enzo David",
    "Yanis Bertrand",
    "Julien Garnier",
  ],
  [
    "Tom Mercier",
    "Ilyes Dupont",
    "Alexis Lambert",
    "Mathis Bonnet",
    "Amine François",
    "Paul Chevalier",
    "Rayan Legrand",
    "Nolan Gauthier",
    "Liam Garcia",
    "Maxime Perrin",
    "Théo Robin",
    "Sami Clément",
    "Victor André",
    "Malo Girard",
    "Sébastien Faure",
  ],
  [
    "Emma Dubois",
    "Jade Morel",
    "Inès Fournier",
    "Lina Rousseau",
    "Alice Vincent",
    "Louise Muller",
    "Chloé Lefèvre",
    "Nour Fontaine",
    "Léa Dumas",
    "Manon Brun",
    "Sarah Masson",
    "Mila Renard",
    "Camille Blanchard",
    "Sophie Nicolas",
  ],
];
export const members: Member[] = teams.flatMap((team, t) =>
  names[t].map((name, i) => ({
    ...memberDefaults,
    id: `${team.id}-member-${i + 1}`,
    team_id: team.id,
    first_name: name.split(" ")[0],
    last_name: name.split(" ")[1],
    email: `demo.${t + 1}.${i + 1}@example.org`,
    role: i === names[t].length - 1 ? "coach" : "player",
    position:
      i === names[t].length - 1
        ? null
        : i === 0
          ? "goalkeeper"
          : i < 6
            ? "defender"
            : i < 11
              ? "midfielder"
              : "forward",
    shirt_number: i === names[t].length - 1 ? null : i + 1,
    jersey_size: "m",
    created_at: stamp(),
  })),
);
export const eventDefaults = {
  ends_at: null,
  meeting_at: null,
  location: null,
  opponent: null,
  venue: null,
  notes: null,
  is_cancelled: false,
  score_for: null,
  score_against: null,
  series_id: null,
};
export const events: Event[] = teams
  .flatMap((team, t) =>
    [-27, -20, -13, -6, 2, 9, 16].map<Event>((offset, i) => ({
      ...eventDefaults,
      id: `${team.id}-match-${i}`,
      team_id: team.id,
      kind: "match",
      title: `Championnat · Journée ${i + 1}`,
      starts_at: day(offset + t, 15),
      ends_at: day(offset + t, 17),
      meeting_at: day(offset + t, 14),
      location: "Stade des Lumières, Lyon",
      opponent: [
        "AS Montchat",
        "FC Val de Saône",
        "US Pierre-Bénite",
        "AS Caluire",
        "FC Croix-Rousse",
        "AS Vénissieux",
        "FC Oullins",
      ][i],
      venue: i % 2 ? "away" : "home",
      notes: "Rendez-vous au stade avec votre équipement, votre gourde et votre tenue du club.",
      score_for: i < 4 ? [3, 2, 1, 4][i] : null,
      score_against: i < 4 ? [1, 2, 2, 0][i] : null,
      created_at: stamp(),
    })),
  )
  .concat(
    teams.flatMap((team, t) =>
      [-10, -3, 0, 4, 7, 11, 14, 18].map<Event>((offset, i) => ({
        ...eventDefaults,
        id: `${team.id}-training-${i}`,
        team_id: team.id,
        kind: "training",
        title: t ? "Entraînement collectif" : "Entraînement · Technique et jeu",
        starts_at: day(offset, 18 + (t % 2)),
        ends_at: day(offset, 20 + (t % 2)),
        location: "Terrain annexe · Stade des Lumières",
        notes: "Échauffement collectif, ateliers techniques et opposition.",
        created_at: stamp(),
      })),
    ),
  );
export const invitations: Invitation[] = events.flatMap((event) =>
  members
    .filter((m) => m.team_id === event.team_id && m.role === "player")
    .map((member, i) => ({
      id: `${event.id}-${member.id}`,
      event_id: event.id,
      member,
      availability:
        i % 9 === 8
          ? "unavailable"
          : i % 8 === 7
            ? "uncertain"
            : i % 7 === 6
              ? "pending"
              : "available",
      comment: null,
      attendance:
        event.starts_at < stamp()
          ? i % 9 === 8
            ? "excused"
            : i % 8 === 7
              ? "late"
              : "on_time"
          : null,
      responded_at: stamp(),
      reminder_count: 0,
      last_reminded_at: null,
    })),
);
export const defaultTasks = [
  { name: "Lavage des maillots", icon: "laundry" as const },
  { name: "Transport", icon: "car" as const },
  { name: "Matériel", icon: "ball" as const },
  { name: "Goûter", icon: "food" as const },
];
export const tasks: TeamTaskResponse[] = teams.flatMap((team) =>
  defaultTasks.map((task, i) => ({ ...task, id: `${team.id}-task-${i}`, team_id: team.id })),
);
export const assignments: AssignmentResponse[] = events
  .filter((e) => e.kind === "match")
  .flatMap((event, i) =>
    tasks
      .filter((t) => t.team_id === event.team_id)
      .slice(0, 2)
      .map((task, j) => ({
        id: `${event.id}-assignment-${j}`,
        event_id: event.id,
        task,
        member: members.filter((m) => m.team_id === event.team_id)[(i + j) % 12],
      })),
  );
export const lineups: Lineup[] = events
  .filter((e) => e.kind === "match")
  .map((event) => ({
    id: `${event.id}-lineup`,
    event_id: event.id,
    formation: "4-3-3",
    is_published: false,
    updated_at: stamp(),
    unavailable_member_ids: [],
    slots: members
      .filter((m) => m.team_id === event.team_id && m.role === "player")
      .slice(0, 14)
      .map((member, i) => ({
        member,
        role: i < 11 ? "starter" : "substitute",
        position_index: i < 11 ? i : null,
      })),
  }));
export const facts: MatchFact[] = events
  .filter((e) => e.score_for !== null)
  .flatMap((event) =>
    Array.from({ length: event.score_for! }, (_, i) => ({
      id: `${event.id}-goal-${i}`,
      event_id: event.id,
      kind: "goal",
      minute: 18 + i * 19,
      member: members.filter((m) => m.team_id === event.team_id)[(i + 8) % 14],
      assist_member: members.filter((m) => m.team_id === event.team_id)[(i + 6) % 14],
    })),
  );
