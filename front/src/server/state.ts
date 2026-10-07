import * as seed from "@/demo/data";
import type { CoreState, WorkspaceState } from "@/workflows/types";
import { blankFlow, syncCoreTasks } from "@/workflows/engine";
import { uid, iso } from "@/workflows/domain";

export function hydrateCore(core: CoreState) {
  const member = (id: string) => core.members.find((m) => m.id === id);
  for (const i of core.invitations) i.member = member(i.member.id) || i.member;
  for (const a of core.assignments) {
    a.member = member(a.member.id) || a.member;
    a.task = core.tasks.find((t) => t.id === a.task.id) || a.task;
  }
  for (const lineup of core.lineups)
    for (const slot of lineup.slots) slot.member = member(slot.member.id) || slot.member;
  for (const fact of core.facts) {
    fact.member = member(fact.member.id) || fact.member;
    if (fact.assist_member)
      fact.assist_member = member(fact.assist_member.id) || fact.assist_member;
  }
  return core;
}
export function initialState(): WorkspaceState {
  const core: CoreState = structuredClone({
    clubs: seed.clubs,
    teams: seed.teams,
    members: seed.members,
    events: seed.events,
    invitations: seed.invitations,
    tasks: seed.tasks,
    assignments: seed.assignments,
    lineups: seed.lineups,
    facts: seed.facts,
  });
  const flow = blankFlow();
  const now = iso();
  flow.profiles = core.members.map((m) => ({
    memberId: m.id,
    photoId: "",
    guardian: "",
    emergencyPhone: "",
    notes: "",
    emailConsent: true,
    smsConsent: false,
    optedOut: false,
  }));
  flow.sponsors = [
    {
      id: "sponsor-cycle",
      name: "Atelier du Cycle",
      contact: "Équipe partenariats",
      email: "partenariats@example.org",
      phone: "",
      website: "https://example.org",
      level: "gold",
      stage: "signed",
      amount: 250000,
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      logoId: "",
      attachmentIds: [],
      notes:
        "Partenaire fictif de démonstration. Dotation équipement et présence sur les communications du club.",
      archived: false,
    },
    {
      id: "sponsor-stade",
      name: "Boulangerie du Stade",
      contact: "Service commercial",
      email: "contact@example.org",
      phone: "",
      website: "",
      level: "silver",
      stage: "proposal",
      amount: 80000,
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      logoId: "",
      attachmentIds: [],
      notes: "Proposition de partenariat à préparer.",
      archived: false,
    },
  ];
  flow.conversations = [
    {
      id: "conversation-staff",
      title: "Organisation du week-end",
      kind: "team",
      teamId: core.teams[0].id,
      eventId: "",
      memberIds: core.members.filter((m) => m.team_id === core.teams[0].id).map((m) => m.id),
      archived: false,
      pinned: true,
      createdAt: now,
      messages: [
        {
          id: uid(),
          author: "Équipe du club · exemple",
          body: "Bienvenue dans la messagerie du club. Centralisons ici les horaires, le covoiturage et les documents du prochain match.",
          attachmentIds: [],
          createdAt: now,
          reactions: [],
        },
      ],
    },
    {
      id: "conversation-annonces",
      title: "Informations du club",
      kind: "announcement",
      teamId: "",
      eventId: "",
      memberIds: core.members.map((m) => m.id),
      archived: false,
      pinned: false,
      createdAt: now,
      messages: [
        {
          id: uid(),
          author: "Équipe du club · exemple",
          body: "Les créneaux et les convocations sont disponibles dans le calendrier. Vous pouvez ajouter ici un document ou une photo.",
          attachmentIds: [],
          createdAt: now,
          reactions: [],
        },
      ],
    },
  ];
  flow.campaigns = [
    {
      id: "campaign-season",
      name: "Informations de rentrée",
      kind: "information",
      channel: "email",
      subject: "{{club}} · Votre saison 2026–2027",
      body: "Bonjour {{prenom}},\n\nRetrouvez le calendrier de {{equipe}}, les convocations et les documents de votre saison dans votre espace club.\n\nÀ bientôt sur le terrain !",
      memberIds: core.members.filter((m) => m.team_id === core.teams[0].id).map((m) => m.id),
      attachmentIds: [],
      status: "draft",
      scheduledAt: null,
      startedAt: null,
      createdAt: now,
      eventId: "",
      sponsorId: "",
      ctaLabel: "",
      ctaUrl: "",
      audienceFrozen: false,
    },
  ];
  flow.collections = [
    {
      id: "collection-season",
      name: "Cotisation saison 2026–2027",
      purpose: "membership",
      amount: 18000,
      dueDate: "2026-11-01",
      installments: 3,
      description: "Licence, entraînements et participation à la vie du club.",
      attachmentIds: [],
      status: "draft",
      createdAt: now,
      memberIds: core.members.filter((m) => m.role === "player").map((m) => m.id),
    },
  ];
  const state = { core, flow };
  syncCoreTasks(state);
  flow.workTasks = flow.workTasks.slice(0, 12);
  flow.workTasks[0].checklist = [
    { id: uid(), text: "Récupérer les tenues après le match", done: false },
    { id: uid(), text: "Vérifier le nombre de maillots", done: false },
    { id: uid(), text: "Déposer les tenues propres au club", done: false },
  ];
  flow.workTasks[0].requireProof = true;
  return state;
}
