import type { Campaign, CoreState, FileRecord, Transaction, WorkspaceState } from "./types";
import { audit, launchCampaign, uid } from "./domain";

/** Operational messages use the same persistent distribution pipeline as campaigns. */
export function notify(
  state: WorkspaceState,
  input: {
    subject: string;
    body: string;
    memberIds: string[];
    eventId?: string;
    attachmentIds?: string[];
    channel?: Campaign["channel"];
  },
  actor: string,
  now: string,
) {
  const memberIds = [...new Set(input.memberIds)].filter((id) =>
    state.core.members.some((m) => m.id === id),
  );
  if (!memberIds.length) return;
  const campaign: Campaign = {
    id: uid(),
    name: input.subject,
    subject: input.subject,
    body: `Bonjour {{prenom}},\n\n${input.body}`,
    kind: "information",
    channel: input.channel || "email",
    memberIds,
    attachmentIds: input.attachmentIds || [],
    eventId: input.eventId || "",
    sponsorId: "",
    ctaLabel: "",
    ctaUrl: "",
    status: "draft",
    scheduledAt: null,
    startedAt: null,
    createdAt: now,
    audienceFrozen: false,
  };
  state.flow.campaigns.unshift(campaign);
  launchCampaign(state, campaign, now);
  audit(
    state,
    actor,
    "campaign",
    campaign.id,
    "automatic_notification",
    "Notification automatique — simulation",
    now,
  );
}

export function notifyTransaction(
  state: WorkspaceState,
  transaction: Transaction,
  actor: string,
  now: string,
) {
  if (transaction.status === "pending") return;
  const charge = state.flow.charges.find((c) => c.id === transaction.chargeId);
  const collection = state.flow.collections.find((c) => c.id === charge?.collectionId);
  if (!charge || !collection) return;
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    transaction.amount / 100,
  );
  const outcome =
    transaction.status === "failed"
      ? "Paiement refusé"
      : transaction.kind === "refund"
        ? "Remboursement confirmé"
        : "Règlement enregistré";
  notify(
    state,
    {
      subject: `${outcome} · ${collection.name}`,
      body: `${outcome} : ${amount}.\nRéférence : ${transaction.reference}.\nÉchéance ${charge.installment} de « ${collection.name} ».\n${transaction.status === "failed" ? "Aucun montant n’a été enregistré. Vous pouvez réessayer depuis le suivi des paiements." : "Votre justificatif est disponible dans le suivi des paiements."}\n${transaction.simulated ? "Transaction simulée, sans mouvement bancaire." : "Règlement déclaré manuellement par le gestionnaire."}`,
      memberIds: [charge.memberId],
    },
    actor,
    now,
  );
}

export function notifyCoreChange(
  before: CoreState,
  state: WorkspaceState,
  path: string,
  method: string,
  actor: string,
  now: string,
  files: FileRecord[],
) {
  const eventId = path.split("/").pop() || "";
  const event = state.core.events.find((e) => e.id === eventId);
  if (!event) return;
  const recipients = state.core.invitations
    .filter((i) => i.event_id === eventId)
    .map((i) => i.member.id);
  const attachmentIds = files
    .filter(
      (f) =>
        f.entityType === "event" &&
        f.entityId === eventId &&
        !["archived", "rejected"].includes(f.status),
    )
    .map((f) => f.id)
    .slice(0, 12);
  if (method === "PATCH" && path.startsWith("/api/v1/events/")) {
    const old = before.events.find((e) => e.id === eventId);
    if (!old) return;
    const fields = [
      "title",
      "starts_at",
      "ends_at",
      "meeting_at",
      "location",
      "opponent",
      "notes",
      "is_cancelled",
    ] as const;
    const changes = fields.some((key) => old[key] !== event[key]);
    const scored =
      event.score_for !== null &&
      event.score_against !== null &&
      (old.score_for !== event.score_for || old.score_against !== event.score_against);
    if (!changes && !scored) return;
    const outcome =
      old.is_cancelled !== event.is_cancelled
        ? event.is_cancelled
          ? "Événement annulé"
          : "Événement rétabli"
        : changes
          ? "Événement modifié"
          : "Résultat enregistré";
    const schedule = new Date(event.starts_at).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    notify(
      state,
      {
        subject: `${outcome} · ${event.title}`,
        eventId,
        memberIds: recipients,
        attachmentIds,
        body: `${outcome} : ${event.title}.\n${event.is_cancelled ? "Ce rendez-vous n’aura pas lieu. Votre convocation est conservée pour le suivi." : `Date : ${schedule} (heure de Paris).\nLieu : ${event.location || "À préciser"}.${event.meeting_at ? `\nRendez-vous : ${new Date(event.meeting_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.` : ""}`}${scored ? `\nScore : ${event.score_for} – ${event.score_against}.` : ""}${event.notes ? `\n${event.notes}` : ""}`,
      },
      actor,
      now,
    );
  }
  if (method === "PUT" && path.startsWith("/api/v1/lineups/")) {
    const lineup = state.core.lineups.find((l) => l.event_id === eventId);
    const old = before.lineups.find((l) => l.event_id === eventId);
    const signature = (l: typeof lineup) =>
      JSON.stringify(
        l && {
          formation: l.formation,
          slots: l.slots.map((s) => `${s.role}:${s.position_index}:${s.member.id}`).sort(),
        },
      );
    if (!lineup?.is_published || (old?.is_published && signature(old) === signature(lineup)))
      return;
    const group = (role: string) =>
      lineup.slots
        .filter((s) => s.role === role)
        .map((s) => `${s.member.first_name} ${s.member.last_name}`)
        .join(", ") || "À compléter";
    notify(
      state,
      {
        subject: `Composition ${old?.is_published ? "actualisée" : "publiée"} · ${event.title}`,
        eventId,
        memberIds: lineup.slots.map((s) => s.member.id),
        attachmentIds,
        body: `La composition de ${event.title} est disponible.\nSchéma : ${lineup.formation}.\nTitulaires : ${group("starter")}.\nRemplaçants : ${group("substitute")}.`,
      },
      actor,
      now,
    );
  }
}
