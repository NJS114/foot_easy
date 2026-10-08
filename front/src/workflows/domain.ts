import type {
  Campaign,
  Charge,
  Collection,
  Competition,
  Delivery,
  FlowState,
  Profile,
  Transaction,
  WorkspaceState,
  CoreState,
} from "./types";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 422,
    public code = "validation_error",
  ) {
    super(message);
  }
}
export const uid = () => crypto.randomUUID();
export const iso = () => new Date().toISOString();
export const get = <T extends { id: string }>(items: T[], id: string): T => {
  const result = items.find((x) => x.id === id);
  if (!result) throw new WorkflowError("Cet élément n’existe plus.", 404, "not_found");
  return result;
};
export function profile(flow: FlowState, memberId: string): Profile {
  let p = flow.profiles.find((x) => x.memberId === memberId);
  if (!p) {
    p = {
      memberId,
      photoId: "",
      guardian: "",
      emergencyPhone: "",
      notes: "",
      emailConsent: false,
      smsConsent: false,
      optedOut: false,
    };
    flow.profiles.push(p);
  }
  return p;
}
export function paidAmount(chargeId: string, transactions: Transaction[]) {
  return transactions
    .filter((t) => t.chargeId === chargeId && t.status === "succeeded")
    .reduce((total, t) => total + (t.kind === "payment" ? t.amount : -t.amount), 0);
}
export function chargeStatus(charge: Charge, transactions: Transaction[], now = iso()): string {
  const paid = paidAmount(charge.id, transactions);
  if (charge.cancelled) return "cancelled";
  if (charge.exempt) return "exempt";
  if (paid >= charge.amount) return "paid";
  if (paid > 0) return "partial";
  if (transactions.some((t) => t.chargeId === charge.id && t.status === "pending"))
    return "pending";
  if (
    transactions.some(
      (t) => t.chargeId === charge.id && t.status === "succeeded" && t.kind === "refund",
    )
  )
    return "refunded";
  if (charge.dueDate < now.slice(0, 10)) return "overdue";
  if (transactions.some((t) => t.chargeId === charge.id && t.status === "failed")) return "failed";
  return "unpaid";
}
export function collectionBalance(collection: Collection, flow: FlowState) {
  const charges = flow.charges.filter(
    (c) => c.collectionId === collection.id && !c.exempt && !c.cancelled,
  );
  return {
    expected: charges.reduce((n, c) => n + c.amount, 0),
    received: charges.reduce((n, c) => n + paidAmount(c.id, flow.transactions), 0),
    count: charges.length,
    paid: charges.filter((c) => paidAmount(c.id, flow.transactions) >= c.amount).length,
  };
}
export function audit(
  state: WorkspaceState,
  actor: string,
  entityType: string,
  entityId: string,
  action: string,
  detail = "",
  at = iso(),
) {
  state.flow.audit.unshift({ id: uid(), at, actor, entityType, entityId, action, detail });
  if (state.flow.audit.length > 2000) state.flow.audit.length = 2000;
}
export function deliveryStep(
  delivery: Delivery,
  status: Delivery["status"],
  detail: string,
  at = iso(),
) {
  if (delivery.status === status && delivery.reason === detail) return;
  delivery.status = status;
  delivery.reason = detail;
  delivery.at = at;
  delivery.history.push({ at, status, detail });
  if (delivery.history.length > 60) delivery.history.shift();
}
export function targetDestination(
  core: CoreState,
  flow: FlowState,
  memberId: string,
  channel: Campaign["channel"],
  marketing: boolean,
) {
  const member = core.members.find((m) => m.id === memberId);
  if (!member) return { member: null, destination: "", reason: "Membre supprimé du club" };
  const preferences = profile(flow, memberId);
  let reason = "";
  const destination =
    channel === "email"
      ? member.email || ""
      : channel === "sms"
        ? member.phone || ""
        : "Espace membre";
  if (preferences.optedOut && marketing) reason = "Désinscription des campagnes";
  else if (marketing && channel === "email" && !preferences.emailConsent)
    reason = "Consentement email absent";
  else if (marketing && channel === "sms" && !preferences.smsConsent)
    reason = "Consentement SMS absent";
  else if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination))
    reason = "Adresse email manquante ou invalide";
  else if (channel === "sms" && !/^\+?[0-9]{10,15}$/.test(destination.replace(/[ .()-]/g, "")))
    reason = "Téléphone manquant ou invalide";
  return { member, destination, reason };
}
export function launchCampaign(state: WorkspaceState, campaign: Campaign, now = iso()) {
  if (!["draft", "scheduled"].includes(campaign.status))
    throw new WorkflowError("Cette campagne a déjà été lancée.");
  if (!campaign.memberIds.length) throw new WorkflowError("Choisissez au moins un destinataire.");
  if (!campaign.body.trim()) throw new WorkflowError("Le contenu est vide.");
  if (campaign.channel === "email" && !campaign.subject.trim())
    throw new WorkflowError("L’objet de l’email est obligatoire.");
  if (campaign.kind === "advertising" && !campaign.sponsorId)
    throw new WorkflowError("Choisissez le sponsor de la campagne.");
  campaign.status = "running";
  campaign.startedAt = now;
  campaign.audienceFrozen = true;
  for (const memberId of campaign.memberIds) {
    const { member, destination, reason } = targetDestination(
      state.core,
      state.flow,
      memberId,
      campaign.channel,
      campaign.kind === "advertising",
    );
    const status = reason ? "excluded" : "queued";
    state.flow.deliveries.push({
      id: uid(),
      campaignId: campaign.id,
      memberId,
      name: member ? `${member.first_name} ${member.last_name}` : "Membre supprimé",
      destination,
      channel: campaign.channel,
      status,
      attempt: 1,
      reason,
      at: now,
      history: [{ at: now, status, detail: reason || "Mise en file — simulation" }],
    });
  }
}
export function tick(state: WorkspaceState, now = iso()): boolean {
  let changed = false;
  const nowMs = Date.parse(now);
  for (const campaign of state.flow.campaigns) {
    if (campaign.status === "scheduled" && campaign.scheduledAt && campaign.scheduledAt <= now) {
      launchCampaign(state, campaign, campaign.scheduledAt);
      audit(
        state,
        "Simulateur",
        "campaign",
        campaign.id,
        "scheduled_start",
        "Départ programmé simulé",
        campaign.scheduledAt,
      );
      changed = true;
    }
    if (campaign.status !== "running") continue;
    const list = state.flow.deliveries.filter((d) => d.campaignId === campaign.id);
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!["queued", "sending", "delivered", "opened"].includes(d.status)) continue;
      const start = Date.parse(
        d.history.findLast((h) => h.status === "queued")?.at || campaign.startedAt || now,
      );
      const elapsed = nowMs - start;
      const step = (status: Delivery["status"], detail: string, offset: number) => {
        deliveryStep(d, status, detail, new Date(start + offset).toISOString());
        changed = true;
      };
      if (d.status === "queued" && elapsed >= 1500)
        step("sending", "Prise en charge par le simulateur", 1500);
      if (d.status === "sending" && elapsed >= 4000) {
        const fail =
          state.flow.settings.deliveryMode === "failure" ||
          (state.flow.settings.deliveryMode === "realistic" && i % 9 === 8 && d.attempt === 1);
        if (fail) step("failed", "Erreur temporaire du fournisseur simulé", 4000);
        else if (
          state.flow.settings.deliveryMode === "realistic" &&
          i % 13 === 12 &&
          d.attempt === 1
        )
          step("bounced", "Adresse rejetée par le fournisseur simulé", 4000);
        else step("delivered", "Remise simulée au destinataire", 4000);
      }
      if (d.status === "delivered" && elapsed >= 8000 && d.channel !== "sms" && i % 3 !== 2)
        step("opened", "Lecture simulée", 8000);
      if (d.status === "opened" && elapsed >= 12000 && campaign.ctaUrl && i % 3 === 0)
        step("clicked", "Clic simulé sur le lien de la campagne", 12000);
    }
    if (
      list.every((d) => !["queued", "sending"].includes(d.status)) &&
      nowMs - Date.parse(campaign.startedAt || now) > 13000
    ) {
      campaign.status = "completed";
      audit(state, "Simulateur", "campaign", campaign.id, "completed", "Simulation terminée", now);
      changed = true;
    }
  }
  for (const placement of state.flow.placements)
    if (placement.status === "active" && placement.endDate < now.slice(0, 10)) {
      placement.status = "ended";
      changed = true;
    }
  return changed;
}
export function ranking(competition: Competition) {
  const table = competition.teams.map((t) => ({
    id: t.id,
    name: t.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    difference: 0,
    points: -t.penalty,
    penalty: t.penalty,
  }));
  for (const fixture of competition.fixtures) {
    if (fixture.status !== "played" || fixture.homeScore === null || fixture.awayScore === null)
      continue;
    const home = get(table, fixture.homeId),
      away = get(table, fixture.awayId);
    home.played++;
    away.played++;
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;
    if (fixture.homeScore === fixture.awayScore) {
      home.draws++;
      away.draws++;
      home.points += competition.drawPoints;
      away.points += competition.drawPoints;
    } else {
      const winner = fixture.homeScore > fixture.awayScore ? home : away,
        loser = winner === home ? away : home;
      winner.wins++;
      loser.losses++;
      winner.points += competition.winPoints;
      loser.points += competition.lossPoints;
    }
  }
  return table
    .map((t) => ({ ...t, difference: t.goalsFor - t.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.difference - a.difference ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name, "fr"),
    );
}
export function personalize(text: string, core: CoreState, memberId: string) {
  const member = core.members.find((m) => m.id === memberId);
  return text.replace(
    /\{\{\s*(prenom|nom|equipe|club)\s*\}\}/g,
    (_, key: string) =>
      ({
        prenom: member?.first_name || "Prénom",
        nom: member?.last_name || "Nom",
        equipe: core.teams.find((t) => t.id === member?.team_id)?.name || "Équipe",
        club: core.clubs[0]?.name || "Club",
      })[key] || "",
  );
}
