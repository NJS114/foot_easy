import { addLocalDays, addMonthsClamped } from "./dates";
import { notify, notifyTransaction } from "./notifications";
import type {
  Campaign,
  Competition,
  FileRecord,
  Fixture,
  FlowState,
  WorkspaceState,
  WorkTask,
} from "./types";
import {
  WorkflowError,
  audit,
  deliveryStep,
  get,
  iso,
  launchCampaign,
  paidAmount,
  profile,
  targetDestination,
  uid,
} from "./domain";

const text = (p: Record<string, unknown>, key: string, max = 10000, required = false) => {
  const v = p[key];
  if (v === undefined || v === null) {
    if (required) throw new WorkflowError(`Le champ « ${key} » est obligatoire.`);
    return "";
  }
  if (typeof v !== "string" || v.length > max)
    throw new WorkflowError(`Le champ « ${key} » est invalide.`);
  const s = v.trim();
  if (required && !s) throw new WorkflowError(`Le champ « ${key} » est obligatoire.`);
  return s;
};
const number = (
  p: Record<string, unknown>,
  key: string,
  min = 0,
  max = 100_000_000,
  fallback = 0,
) => {
  const v = p[key] === undefined ? fallback : Number(p[key]);
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < min || v > max)
    throw new WorkflowError(`Valeur invalide pour « ${key} ».`);
  return v;
};
const bool = (p: Record<string, unknown>, key: string) => p[key] === true;
const strings = (p: Record<string, unknown>, key: string, max = 1000): string[] => {
  if (p[key] === undefined) return [];
  const v = p[key];
  if (!Array.isArray(v) || v.length > max || v.some((s) => typeof s !== "string" || s.length > 200))
    throw new WorkflowError(`Liste « ${key} » invalide.`);
  return [...new Set(v as string[])];
};
const choice = <T extends string>(
  p: Record<string, unknown>,
  key: string,
  values: readonly T[],
  fallback: T,
): T => {
  const v = p[key] ?? fallback;
  if (!values.includes(v as T)) throw new WorkflowError(`Choix invalide pour « ${key} ».`);
  return v as T;
};
const date = (p: Record<string, unknown>, key: string, required = false) => {
  const v = text(p, key, 40, required);
  if (v && !Number.isFinite(Date.parse(v)))
    throw new WorkflowError("La date indiquée est invalide.");
  return v;
};
const link = (p: Record<string, unknown>, key: string) => {
  const v = text(p, key, 2048);
  if (v) {
    try {
      const u = new URL(v);
      if (!["https:", "http:"].includes(u.protocol)) throw new Error();
    } catch {
      throw new WorkflowError("Utilisez une adresse http ou https valide.");
    }
  }
  return v;
};
function attachments(p: Record<string, unknown>, files: FileRecord[]) {
  const ids = strings(p, "attachmentIds", 12);
  for (const id of ids) {
    const file = get(files, id);
    if (file.status === "archived" || file.status === "rejected")
      throw new WorkflowError("Un fichier sélectionné est archivé ou rejeté.");
  }
  return ids;
}
function members(p: Record<string, unknown>, state: WorkspaceState) {
  const ids = strings(p, "memberIds");
  for (const id of ids) get(state.core.members, id);
  return ids;
}
function assertCampaignEditable(c: Campaign) {
  if (c.status !== "draft")
    throw new WorkflowError(
      "Seul un brouillon peut être modifié. Dupliquez la campagne pour préparer un nouvel envoi.",
    );
}
function entityAudit(
  state: WorkspaceState,
  actor: string,
  type: string,
  id: string,
  detail: string,
) {
  audit(state, actor, type.split(".")[0], id, type.split(".").slice(1).join("."), detail);
  return { entityId: id, message: detail };
}
export function applyAction(
  state: WorkspaceState,
  type: string,
  p: Record<string, unknown>,
  actor: string,
  files: FileRecord[] = [],
  now = iso(),
): { entityId: string; message: string } {
  const { core, flow } = state;
  const entityId = text(p, "id", 200);
  switch (type) {
    case "campaign.save": {
      const existing = entityId ? get(flow.campaigns, entityId) : null;
      if (existing) assertCampaignEditable(existing);
      const sponsorId = text(p, "sponsorId", 200);
      if (sponsorId) get(flow.sponsors, sponsorId);
      const eventId = text(p, "eventId", 200);
      if (eventId) get(core.events, eventId);
      const campaign: Campaign = {
        id: existing?.id || uid(),
        name: text(p, "name", 160, true),
        kind: choice(
          p,
          "kind",
          ["information", "invitation", "reminder", "advertising"],
          "information",
        ),
        channel: choice(p, "channel", ["email", "sms", "push", "inapp"], "email"),
        subject: text(p, "subject", 200),
        body: text(p, "body", 20000),
        memberIds: members(p, state),
        attachmentIds: attachments(p, files),
        status: "draft",
        scheduledAt: null,
        startedAt: null,
        createdAt: existing?.createdAt || now,
        eventId,
        sponsorId,
        ctaLabel: text(p, "ctaLabel", 80),
        ctaUrl: link(p, "ctaUrl"),
        audienceFrozen: false,
      };
      if (campaign.channel === "sms" && campaign.body.length > 1600)
        throw new WorkflowError("Le SMS est limité à 1 600 caractères.");
      if (existing) Object.assign(existing, campaign);
      else flow.campaigns.unshift(campaign);
      return entityAudit(state, actor, type, campaign.id, "Brouillon enregistré");
    }
    case "campaign.start": {
      const c = get(flow.campaigns, entityId);
      assertCampaignEditable(c);
      launchCampaign(state, c, now);
      return entityAudit(state, actor, type, c.id, "Campagne lancée en simulation");
    }
    case "campaign.schedule": {
      const c = get(flow.campaigns, entityId);
      assertCampaignEditable(c);
      const at = date(p, "scheduledAt", true);
      if (Date.parse(at) <= Date.parse(now)) throw new WorkflowError("Choisissez une date future.");
      if (!c.memberIds.length || !c.body || (c.channel === "email" && !c.subject))
        throw new WorkflowError("Complétez les destinataires et le contenu avant de programmer.");
      if (c.kind === "advertising" && !c.sponsorId)
        throw new WorkflowError("Choisissez un sponsor.");
      c.scheduledAt = new Date(at).toISOString();
      c.status = "scheduled";
      return entityAudit(state, actor, type, c.id, "Campagne programmée");
    }
    case "campaign.pause": {
      const c = get(flow.campaigns, entityId);
      if (c.status !== "running")
        throw new WorkflowError("Cette campagne ne peut pas être mise en pause.");
      c.status = "paused";
      return entityAudit(state, actor, type, c.id, "Simulation mise en pause");
    }
    case "campaign.resume": {
      const c = get(flow.campaigns, entityId);
      if (c.status !== "paused") throw new WorkflowError("Cette campagne n’est pas en pause.");
      c.status = "running";
      c.startedAt = now;
      flow.deliveries
        .filter((d) => d.campaignId === c.id && ["queued", "sending"].includes(d.status))
        .forEach((d) => deliveryStep(d, "queued", "Reprise de la simulation", now));
      return entityAudit(state, actor, type, c.id, "Simulation reprise");
    }
    case "campaign.cancel": {
      const c = get(flow.campaigns, entityId);
      if (["completed", "cancelled"].includes(c.status))
        throw new WorkflowError("Cette campagne est déjà terminée.");
      c.status = "cancelled";
      flow.deliveries
        .filter((d) => d.campaignId === c.id && ["queued", "sending"].includes(d.status))
        .forEach((d) => deliveryStep(d, "cancelled", "Annulé avant remise simulée", now));
      return entityAudit(state, actor, type, c.id, "Campagne annulée");
    }
    case "campaign.duplicate": {
      const c = get(flow.campaigns, entityId);
      const copy = {
        ...structuredClone(c),
        id: uid(),
        name: `${c.name} — copie`,
        status: "draft" as const,
        scheduledAt: null,
        startedAt: null,
        createdAt: now,
        audienceFrozen: false,
      };
      flow.campaigns.unshift(copy);
      return entityAudit(state, actor, type, copy.id, "Copie enregistrée en brouillon");
    }
    case "campaign.retry": {
      const c = get(flow.campaigns, entityId);
      if (!["completed", "running", "paused"].includes(c.status))
        throw new WorkflowError("Cette campagne ne peut pas être relancée.");
      const retries = flow.deliveries.filter(
        (d) => d.campaignId === c.id && ["failed", "bounced"].includes(d.status),
      );
      if (!retries.length) throw new WorkflowError("Aucun échec à relancer.");
      for (const d of retries) {
        if (d.attempt >= 5) continue;
        const { destination, reason } = targetDestination(
          core,
          flow,
          d.memberId,
          d.channel,
          c.kind === "advertising",
        );
        d.destination = destination;
        d.attempt++;
        deliveryStep(
          d,
          reason ? "excluded" : "queued",
          reason || "Nouvelle tentative simulée",
          now,
        );
      }
      c.status = "running";
      c.startedAt = now;
      return entityAudit(
        state,
        actor,
        type,
        c.id,
        "Échecs remis en file, sans doublonner les livraisons réussies",
      );
    }
    case "campaign.test": {
      const c = get(flow.campaigns, entityId);
      if (!c.body.trim()) throw new WorkflowError("Ajoutez un contenu avant le test.");
      return entityAudit(
        state,
        actor,
        type,
        c.id,
        "Test validé par le simulateur. Aucun envoi externe.",
      );
    }
    case "delivery.outcome": {
      const d = get(flow.deliveries, entityId);
      const outcome = choice(
        p,
        "outcome",
        ["delivered", "opened", "clicked", "failed", "bounced", "unsubscribed"],
        "delivered",
      );
      if (["excluded", "cancelled"].includes(d.status))
        throw new WorkflowError("Un envoi exclu ou annulé ne peut pas progresser.");
      if (outcome === "unsubscribed") profile(flow, d.memberId).optedOut = true;
      deliveryStep(d, outcome, "Statut appliqué manuellement dans le simulateur", now);
      return entityAudit(state, actor, type, d.campaignId, "Statut simulé mis à jour");
    }
    case "conversation.save": {
      const title = text(p, "title", 160, true);
      const memberIds = members(p, state);
      const kind = choice(p, "kind", ["team", "direct", "announcement"], "team");
      if (kind === "direct" && memberIds.length !== 1)
        throw new WorkflowError("Une conversation directe nécessite un destinataire.");
      const teamId = text(p, "teamId", 200),
        eventId = text(p, "eventId", 200);
      if (teamId) get(core.teams, teamId);
      if (eventId) get(core.events, eventId);
      const conversation = {
        id: uid(),
        title,
        kind,
        memberIds,
        teamId,
        eventId,
        archived: false,
        pinned: false,
        messages: [],
        createdAt: now,
      };
      flow.conversations.unshift(conversation);
      return entityAudit(state, actor, type, conversation.id, "Conversation créée");
    }
    case "conversation.reply": {
      const c = get(flow.conversations, entityId);
      if (c.archived) throw new WorkflowError("Rouvrez la conversation avant de répondre.");
      const body = text(p, "body", 12000),
        attachmentIds = attachments(p, files);
      if (!body && !attachmentIds.length)
        throw new WorkflowError("Écrivez un message ou ajoutez un fichier.");
      c.messages.push({
        id: uid(),
        author: actor,
        body,
        attachmentIds,
        createdAt: now,
        reactions: [],
      });
      notify(
        state,
        {
          subject: `Nouveau message · ${c.title}`,
          body: `${actor} a publié un message :\n${body || "Pièce jointe disponible dans la conversation."}`,
          memberIds: c.memberIds,
          eventId: c.eventId,
          attachmentIds,
          channel: "inapp",
        },
        actor,
        now,
      );
      return entityAudit(state, actor, type, c.id, "Message ajouté à l’espace privé");
    }
    case "conversation.toggle": {
      const c = get(flow.conversations, entityId);
      const field = choice(p, "field", ["archived", "pinned"], "archived");
      c[field] = !c[field];
      return entityAudit(
        state,
        actor,
        type,
        c.id,
        field === "archived"
          ? c.archived
            ? "Conversation archivée"
            : "Conversation rouverte"
          : c.pinned
            ? "Conversation épinglée"
            : "Conversation détachée",
      );
    }
    case "message.react": {
      const c = get(flow.conversations, entityId),
        message = get(c.messages, text(p, "messageId", 200, true));
      message.reactions = message.reactions.includes(actor)
        ? message.reactions.filter((a) => a !== actor)
        : [...message.reactions, actor];
      return { entityId: c.id, message: "Réaction enregistrée" };
    }
    case "sponsor.save": {
      const existing = entityId ? get(flow.sponsors, entityId) : null;
      const logoId = text(p, "logoId", 200);
      if (logoId && !get(files, logoId).mime.startsWith("image/"))
        throw new WorkflowError("Le logo doit être une image.");
      const startDate = date(p, "startDate"),
        endDate = date(p, "endDate");
      if (startDate && endDate && endDate < startDate)
        throw new WorkflowError("La fin du partenariat doit suivre son début.");
      const sponsor = {
        id: existing?.id || uid(),
        name: text(p, "name", 160, true),
        contact: text(p, "contact", 160),
        email: text(p, "email", 200),
        phone: text(p, "phone", 40),
        website: link(p, "website"),
        level: choice(p, "level", ["bronze", "silver", "gold"], "bronze"),
        stage: choice(
          p,
          "stage",
          ["prospect", "contacted", "proposal", "negotiation", "signed", "declined"],
          "prospect",
        ),
        amount: number(p, "amount"),
        startDate,
        endDate,
        logoId,
        attachmentIds: attachments(p, files),
        notes: text(p, "notes", 10000),
        archived: existing?.archived || false,
      };
      if (existing) Object.assign(existing, sponsor);
      else flow.sponsors.unshift(sponsor);
      return entityAudit(state, actor, type, sponsor.id, "Partenariat enregistré");
    }
    case "sponsor.archive": {
      const s = get(flow.sponsors, entityId);
      s.archived = !s.archived;
      if (s.archived)
        for (const placement of flow.placements.filter(
          (p) => p.sponsorId === s.id && p.status === "active",
        ))
          placement.status = "paused";
      return entityAudit(
        state,
        actor,
        type,
        s.id,
        s.archived ? "Partenaire archivé, publicités mises en pause" : "Partenaire restauré",
      );
    }
    case "placement.save": {
      const sponsor = get(flow.sponsors, text(p, "sponsorId", 200, true));
      if (sponsor.archived) throw new WorkflowError("Ce sponsor est archivé.");
      const existing = entityId ? get(flow.placements, entityId) : null;
      const imageId = text(p, "imageId", 200);
      if (imageId && !get(files, imageId).mime.startsWith("image/"))
        throw new WorkflowError("Le visuel doit être une image.");
      const startDate = date(p, "startDate", true),
        endDate = date(p, "endDate", true);
      if (endDate < startDate) throw new WorkflowError("La période de diffusion est invalide.");
      const placement = {
        id: existing?.id || uid(),
        sponsorId: sponsor.id,
        name: text(p, "name", 160, true),
        surface: choice(p, "surface", ["dashboard", "calendar", "newsletter"], "dashboard"),
        imageId,
        url: link(p, "url"),
        startDate,
        endDate,
        status: existing?.status || ("draft" as const),
        impressions: existing?.impressions || 0,
        clicks: existing?.clicks || 0,
        budget: number(p, "budget"),
      };
      if (existing) Object.assign(existing, placement);
      else flow.placements.unshift(placement);
      return entityAudit(state, actor, type, placement.id, "Emplacement publicitaire enregistré");
    }
    case "placement.status": {
      const placement = get(flow.placements, entityId);
      const status = choice(p, "status", ["draft", "active", "paused", "ended"], "active");
      if (status === "active" && (!placement.imageId || !placement.url))
        throw new WorkflowError("Ajoutez un visuel et un lien avant d’activer la publicité.");
      if (status === "active" && get(flow.sponsors, placement.sponsorId).archived)
        throw new WorkflowError("Le sponsor est archivé.");
      if (status === "active" && placement.endDate.slice(0, 10) < now.slice(0, 10))
        throw new WorkflowError("La période de diffusion est expirée.");
      placement.status = status;
      return entityAudit(state, actor, type, placement.id, "Diffusion mise à jour");
    }
    case "placement.simulate": {
      const placement = get(flow.placements, entityId);
      const impressions = number(p, "impressions", 0, 10000),
        clicks = number(p, "clicks", 0, 10000);
      if (clicks > impressions)
        throw new WorkflowError("Les clics ne peuvent pas dépasser les impressions.");
      placement.impressions += impressions;
      placement.clicks += clicks;
      return entityAudit(state, actor, type, placement.id, "Mesures de simulation ajoutées");
    }
    case "collection.save": {
      const existing = entityId ? get(flow.collections, entityId) : null;
      if (existing && existing.status !== "draft")
        throw new WorkflowError(
          "Une collecte ouverte ne peut plus changer de montant ou de destinataires.",
        );
      const collection = {
        id: existing?.id || uid(),
        name: text(p, "name", 160, true),
        purpose: choice(
          p,
          "purpose",
          ["membership", "equipment", "tournament", "donation"],
          "membership",
        ),
        amount: number(p, "amount", 100),
        dueDate: date(p, "dueDate", true),
        installments: number(p, "installments", 1, 12, 1),
        description: text(p, "description", 10000),
        attachmentIds: attachments(p, files),
        status: "draft" as const,
        createdAt: existing?.createdAt || now,
        memberIds: members(p, state),
      };
      if (existing) Object.assign(existing, collection);
      else flow.collections.unshift(collection);
      return entityAudit(state, actor, type, collection.id, "Collecte enregistrée en brouillon");
    }
    case "collection.open": {
      const c = get(flow.collections, entityId);
      if (c.status !== "draft") throw new WorkflowError("Cette collecte a déjà été ouverte.");
      if (!c.memberIds.length) throw new WorkflowError("Choisissez les membres concernés.");
      for (const memberId of c.memberIds)
        for (let i = 0; i < c.installments; i++) {
          const due = addMonthsClamped(c.dueDate, i);
          const amount =
            Math.floor(c.amount / c.installments) + (i < c.amount % c.installments ? 1 : 0);
          flow.charges.push({
            id: uid(),
            collectionId: c.id,
            memberId,
            amount,
            dueDate: due,
            installment: i + 1,
            exempt: false,
            cancelled: false,
          });
        }
      c.status = "open";
      return entityAudit(state, actor, type, c.id, "Collecte ouverte et échéances créées");
    }
    case "collection.close": {
      const c = get(flow.collections, entityId);
      if (c.status !== "open") throw new WorkflowError("Cette collecte n’est pas ouverte.");
      c.status = "closed";
      return entityAudit(state, actor, type, c.id, "Collecte clôturée");
    }
    case "collection.duplicate": {
      const c = get(flow.collections, entityId);
      const copy = {
        ...structuredClone(c),
        id: uid(),
        name: c.name + " — copie",
        status: "draft" as const,
        createdAt: now,
      };
      flow.collections.unshift(copy);
      return entityAudit(state, actor, type, copy.id, "Collecte dupliquée");
    }
    case "charge.exempt":
    case "charge.cancel": {
      const charge = get(flow.charges, entityId);
      if (paidAmount(charge.id, flow.transactions) > 0)
        throw new WorkflowError("Remboursez les sommes reçues avant cette action.");
      if (flow.transactions.some((t) => t.chargeId === charge.id && t.status === "pending"))
        throw new WorkflowError("Une transaction est en attente.");
      if (type === "charge.exempt") charge.exempt = !charge.exempt;
      else charge.cancelled = true;
      return entityAudit(state, actor, type, charge.collectionId, "Échéance mise à jour");
    }
    case "payment.record": {
      const charge = get(flow.charges, text(p, "chargeId", 200, true));
      const collection = get(flow.collections, charge.collectionId);
      if (collection.status !== "open" || charge.exempt || charge.cancelled)
        throw new WorkflowError("Cette échéance ne peut pas être réglée.");
      if (flow.transactions.some((t) => t.chargeId === charge.id && t.status === "pending"))
        throw new WorkflowError("Résolvez d’abord la transaction en attente.");
      const amount = number(p, "amount", 1);
      if (amount > charge.amount - paidAmount(charge.id, flow.transactions))
        throw new WorkflowError("Le montant dépasse le reste à payer.");
      const method = choice(p, "method", ["card", "cash", "transfer", "cheque"], "card");
      const status = choice(p, "status", ["pending", "succeeded", "failed"], "succeeded");
      if (method !== "card" && status !== "succeeded")
        throw new WorkflowError("Un règlement manuel est confirmé directement.");
      const note = text(p, "note", 2000);
      const transaction = {
        id: uid(),
        chargeId: charge.id,
        amount,
        kind: "payment" as const,
        method,
        status,
        reference: `FE-${now.slice(0, 10).replace(/-/g, "")}-${uid().slice(0, 8).toUpperCase()}`,
        createdAt: now,
        note,
        simulated: method === "card",
      };
      flow.transactions.unshift(transaction);
      notifyTransaction(state, transaction, actor, now);
      return entityAudit(
        state,
        actor,
        type,
        charge.collectionId,
        method === "card" ? "Paiement simulé enregistré" : "Règlement manuel enregistré",
      );
    }
    case "payment.resolve": {
      const t = get(flow.transactions, entityId);
      if (t.status !== "pending") throw new WorkflowError("Cette transaction a déjà été traitée.");
      const status = choice(p, "status", ["succeeded", "failed"], "succeeded");
      const charge = get(flow.charges, t.chargeId);
      if (
        status === "succeeded" &&
        paidAmount(charge.id, flow.transactions) + t.amount > charge.amount
      )
        throw new WorkflowError("Le règlement dépasse le montant dû.");
      t.status = status;
      notifyTransaction(state, t, actor, now);
      return entityAudit(
        state,
        actor,
        type,
        charge.collectionId,
        "Validation du paiement simulé enregistrée",
      );
    }
    case "payment.refund": {
      const charge = get(flow.charges, text(p, "chargeId", 200, true));
      const amount = number(p, "amount", 1);
      if (amount > paidAmount(charge.id, flow.transactions))
        throw new WorkflowError("Le remboursement dépasse le montant encaissé.");
      const note = text(p, "note", 2000, true);
      const transaction = {
        id: uid(),
        chargeId: charge.id,
        amount,
        kind: "refund" as const,
        method: choice(p, "method", ["card", "cash", "transfer", "cheque"], "card"),
        status: "succeeded" as const,
        reference: `AV-${uid().slice(0, 8).toUpperCase()}`,
        createdAt: now,
        note,
        simulated: true,
      };
      flow.transactions.unshift(transaction);
      notifyTransaction(state, transaction, actor, now);
      return entityAudit(
        state,
        actor,
        type,
        charge.collectionId,
        "Remboursement simulé enregistré",
      );
    }
    case "collection.remind": {
      const collection = get(flow.collections, entityId);
      const ids = [
        ...new Set(
          flow.charges
            .filter(
              (c) =>
                c.collectionId === entityId &&
                !c.cancelled &&
                !c.exempt &&
                paidAmount(c.id, flow.transactions) < c.amount,
            )
            .map((c) => c.memberId),
        ),
      ];
      if (!ids.length) throw new WorkflowError("Tous les règlements sont à jour.");
      const campaign: Campaign = {
        id: uid(),
        name: `Relance · ${collection.name}`,
        kind: "reminder",
        channel: choice(p, "channel", ["email", "sms", "push", "inapp"], "email"),
        subject: `Rappel : ${collection.name}`,
        body: `Bonjour {{prenom}}, une échéance de la collecte « ${collection.name} » reste à régler. Merci de vous rapprocher du club.`,
        memberIds: ids,
        attachmentIds: collection.attachmentIds,
        status: "draft",
        scheduledAt: null,
        startedAt: null,
        createdAt: now,
        eventId: "",
        sponsorId: "",
        ctaLabel: "",
        ctaUrl: "",
        audienceFrozen: false,
      };
      flow.campaigns.unshift(campaign);
      return entityAudit(
        state,
        actor,
        type,
        campaign.id,
        "Brouillon de relance créé pour les impayés uniquement",
      );
    }
    case "task.save": {
      const existing = entityId ? get(flow.workTasks, entityId) : null;
      if (existing && ["done", "cancelled", "submitted"].includes(existing.status))
        throw new WorkflowError("Rouvrez cette tâche avant de la modifier.");
      const teamId = text(p, "teamId", 200, true),
        memberId = text(p, "memberId", 200),
        eventId = text(p, "eventId", 200);
      get(core.teams, teamId);
      if (memberId && get(core.members, memberId).team_id !== teamId)
        throw new WorkflowError("Le responsable doit appartenir à cette équipe.");
      if (eventId && get(core.events, eventId).team_id !== teamId)
        throw new WorkflowError("L’événement appartient à une autre équipe.");
      const checklist = strings(p, "checklist", 30).map((value, i) => ({
        id: existing?.checklist[i]?.id || uid(),
        text: value,
        done: existing?.checklist[i]?.text === value ? existing.checklist[i].done : false,
      }));
      const task: WorkTask = {
        id: existing?.id || uid(),
        title: text(p, "title", 160, true),
        description: text(p, "description", 10000),
        teamId,
        eventId,
        memberId,
        dueAt: date(p, "dueAt", true),
        priority: choice(p, "priority", ["low", "normal", "high"], "normal"),
        status: existing?.status || "todo",
        checklist,
        attachmentIds: attachments(p, files),
        requireProof: bool(p, "requireProof"),
        comments: existing?.comments || [],
        createdAt: existing?.createdAt || now,
        assignmentId: existing?.assignmentId || "",
      };
      if (task.assignmentId) {
        const assignment = core.assignments.find((a) => a.id === task.assignmentId);
        if (assignment && memberId && eventId && assignment.task.team_id === teamId) {
          assignment.member = get(core.members, memberId);
          assignment.event_id = eventId;
        } else {
          core.assignments = core.assignments.filter((a) => a.id !== task.assignmentId);
          task.assignmentId = "";
        }
      }
      if (memberId && eventId && !task.assignmentId) {
        let catalog = core.tasks.find((t) => t.team_id === teamId && t.name === task.title);
        if (!catalog) {
          catalog = { id: uid(), team_id: teamId, name: task.title, icon: "other" };
          core.tasks.push(catalog);
        }
        const already = core.assignments.find(
          (a) => a.task.id === catalog.id && a.member.id === memberId && a.event_id === eventId,
        );
        if (already)
          throw new WorkflowError("Cette responsabilité est déjà attribuée à ce membre.");
        task.assignmentId = uid();
        core.assignments.push({
          id: task.assignmentId,
          event_id: eventId,
          member: get(core.members, memberId),
          task: catalog,
        });
      }
      const assignmentChanged =
        !existing ||
        existing.memberId !== task.memberId ||
        existing.title !== task.title ||
        existing.dueAt !== task.dueAt;
      if (existing) Object.assign(existing, task);
      else flow.workTasks.unshift(task);
      if (task.memberId && assignmentChanged)
        notify(
          state,
          {
            subject: `Responsabilité attribuée · ${task.title}`,
            body: `La tâche « ${task.title} » vous est attribuée.\nÉchéance : ${new Date(task.dueAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (heure de Paris).\n${task.description}`,
            memberIds: [task.memberId],
            eventId: task.eventId,
            attachmentIds: task.attachmentIds,
          },
          actor,
          now,
        );
      return entityAudit(state, actor, type, task.id, "Tâche enregistrée");
    }
    case "task.transition": {
      const task = get(flow.workTasks, entityId);
      const status = choice(
        p,
        "status",
        ["todo", "in_progress", "blocked", "submitted", "done", "cancelled"],
        "in_progress",
      );
      const allowed: Record<WorkTask["status"], WorkTask["status"][]> = {
        todo: ["in_progress", "cancelled"],
        in_progress: ["blocked", "submitted", "cancelled"],
        blocked: ["in_progress", "cancelled"],
        submitted: ["done", "in_progress"],
        done: ["todo"],
        cancelled: ["todo"],
      };
      if (!allowed[task.status].includes(status))
        throw new WorkflowError("Cette transition de tâche n’est pas autorisée.");
      if (
        ["submitted", "done"].includes(status) &&
        (task.checklist.some((c) => !c.done) ||
          (task.requireProof &&
            !files.some(
              (f) =>
                f.entityType === "task" &&
                f.entityId === task.id &&
                f.status !== "archived" &&
                f.status !== "rejected",
            )))
      )
        throw new WorkflowError("Terminez la checklist et ajoutez le justificatif demandé.");
      const needsReason =
        status === "blocked" || (task.status === "submitted" && status === "in_progress");
      const reason = text(p, "reason", 2000, needsReason);
      if (needsReason) {
        task.comments.push({
          id: uid(),
          author: actor,
          body: reason,
          attachmentIds: [],
          createdAt: now,
          reactions: [],
        });
      }
      task.status = status;
      if (task.memberId)
        notify(
          state,
          {
            subject: `Suivi de tâche · ${task.title}`,
            body: `Le statut de « ${task.title} » est maintenant : ${{ todo: "à faire", in_progress: "en cours", blocked: "bloqué", submitted: "à valider", done: "terminé", cancelled: "annulé" }[status]}.${reason ? `\nMotif : ${reason}` : ""}`,
            memberIds: [task.memberId],
            eventId: task.eventId,
          },
          actor,
          now,
        );
      return entityAudit(state, actor, type, task.id, "Statut de la tâche mis à jour");
    }
    case "task.check": {
      const task = get(flow.workTasks, entityId);
      if (["done", "cancelled", "submitted"].includes(task.status))
        throw new WorkflowError("Cette tâche est clôturée.");
      const item = get(task.checklist, text(p, "itemId", 200, true));
      item.done = bool(p, "done");
      return { entityId: task.id, message: "Checklist enregistrée" };
    }
    case "task.comment": {
      const task = get(flow.workTasks, entityId);
      const body = text(p, "body", 10000),
        attachmentIds = attachments(p, files);
      if (!body && !attachmentIds.length)
        throw new WorkflowError("Ajoutez un commentaire ou un fichier.");
      task.comments.push({
        id: uid(),
        author: actor,
        body,
        attachmentIds,
        createdAt: now,
        reactions: [],
      });
      return entityAudit(state, actor, type, task.id, "Commentaire ajouté");
    }
    case "profile.save": {
      get(core.members, entityId);
      const current = profile(flow, entityId),
        photoId = text(p, "photoId", 200);
      if (photoId && !get(files, photoId).mime.startsWith("image/"))
        throw new WorkflowError("La photo doit être une image.");
      Object.assign(current, {
        photoId,
        guardian: text(p, "guardian", 200),
        emergencyPhone: text(p, "emergencyPhone", 40),
        notes: text(p, "notes", 10000),
        emailConsent: bool(p, "emailConsent"),
        smsConsent: bool(p, "smsConsent"),
        optedOut: bool(p, "optedOut"),
      });
      return entityAudit(state, actor, type, entityId, "Dossier membre enregistré");
    }
    case "settings.save": {
      flow.settings.deliveryMode = choice(
        p,
        "deliveryMode",
        ["success", "realistic", "failure"],
        "realistic",
      );
      return entityAudit(
        state,
        actor,
        type,
        "integrations",
        "Comportement du simulateur enregistré",
      );
    }
    case "competition.save": {
      const existing = entityId ? get(flow.competitions, entityId) : null;
      if (existing && existing.status !== "draft")
        throw new WorkflowError(
          "Le championnat doit être en brouillon pour modifier sa structure.",
        );
      const raw = p.teams;
      if (!Array.isArray(raw) || raw.length < 2 || raw.length > 32)
        throw new WorkflowError("Ajoutez entre 2 et 32 équipes.");
      const teamNames = new Set<string>();
      const clubTeams = new Set<string>();
      const competitionTeams = raw.map((v: unknown) => {
        if (!v || typeof v !== "object") throw new WorkflowError("Équipe invalide.");
        const t = v as Record<string, unknown>;
        const name = text(t, "name", 100, true),
          internalTeamId = text(t, "internalTeamId", 200);
        if (teamNames.has(name.toLowerCase()))
          throw new WorkflowError("Les noms d’équipes doivent être distincts.");
        teamNames.add(name.toLowerCase());
        if (internalTeamId) {
          get(core.teams, internalTeamId);
          if (clubTeams.has(internalTeamId))
            throw new WorkflowError("Une équipe du club apparaît deux fois.");
          clubTeams.add(internalTeamId);
        }
        const logoId = text(t, "logoId", 200);
        if (logoId) get(files, logoId);
        return {
          id: text(t, "id", 200) || uid(),
          name,
          internalTeamId,
          logoId,
          penalty: number(t, "penalty", 0, 100),
        };
      });
      const competition: Competition = {
        id: existing?.id || uid(),
        name: text(p, "name", 160, true),
        season: text(p, "season", 40, true),
        category: text(p, "category", 80),
        winPoints: number(p, "winPoints", 0, 10, 3),
        drawPoints: number(p, "drawPoints", 0, 10, 1),
        lossPoints: number(p, "lossPoints", -5, 10, 0),
        teams: competitionTeams,
        status: "draft",
        fixtures: [],
        attachmentIds: attachments(p, files),
      };
      if (existing) Object.assign(existing, competition);
      else flow.competitions.unshift(competition);
      return entityAudit(state, actor, type, competition.id, "Championnat enregistré");
    }
    case "competition.generate": {
      const c = get(flow.competitions, entityId);
      if (c.status !== "draft" || c.fixtures.length)
        throw new WorkflowError("Un calendrier a déjà été généré.");
      const start = date(p, "startsAt", true);
      const interval = number(p, "intervalDays", 1, 60, 7),
        returnLeg = bool(p, "returnLeg");
      const participants: (string | null)[] = c.teams.map((t) => t.id);
      if (participants.length % 2) participants.push(null);
      const fixtures: Fixture[] = [];
      for (let round = 0; round < participants.length - 1; round++) {
        for (let i = 0; i < participants.length / 2; i++) {
          let homeId = participants[i],
            awayId = participants[participants.length - 1 - i];
          if (!homeId || !awayId) continue;
          if (round % 2) [homeId, awayId] = [awayId, homeId];
          const startsAt = addLocalDays(
            start,
            round * interval,
            text(p, "timezone", 100) || "Europe/Paris",
          );
          fixtures.push({
            id: uid(),
            round: round + 1,
            homeId,
            awayId,
            startsAt,
            location: "À préciser",
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            eventId: "",
            attachmentIds: [],
          });
        }
        participants.splice(1, 0, participants.pop()!);
      }
      if (returnLeg) {
        const rounds = participants.length - 1;
        fixtures.push(
          ...fixtures.map((f) => {
            const startsAt = addLocalDays(
              f.startsAt,
              rounds * interval,
              text(p, "timezone", 100) || "Europe/Paris",
            );
            return {
              ...f,
              id: uid(),
              round: f.round + rounds,
              homeId: f.awayId,
              awayId: f.homeId,
              startsAt,
            };
          }),
        );
      }
      for (const f of fixtures) {
        const home = get(c.teams, f.homeId),
          away = get(c.teams, f.awayId);
        const internal = home.internalTeamId || away.internalTeamId;
        if (internal) {
          const eventId = uid();
          core.events.push({
            id: eventId,
            team_id: internal,
            kind: "match",
            title: `${c.name} · J${f.round}`,
            starts_at: f.startsAt,
            ends_at: null,
            meeting_at: null,
            location: f.location,
            opponent: home.internalTeamId ? away.name : home.name,
            venue: home.internalTeamId ? "home" : "away",
            notes: "Match lié au championnat.",
            is_cancelled: false,
            score_for: null,
            score_against: null,
            series_id: null,
            created_at: now,
          });
          f.eventId = eventId;
        }
      }
      c.fixtures = fixtures;
      c.status = "active";
      return entityAudit(
        state,
        actor,
        type,
        c.id,
        `${fixtures.length} rencontres générées et matchs du club ajoutés au calendrier`,
      );
    }
    case "competition.fixture": {
      const c = get(flow.competitions, entityId);
      if (c.status !== "active") throw new WorkflowError("Ce championnat n’est pas actif.");
      const f = get(c.fixtures, text(p, "fixtureId", 200, true));
      const status = choice(
        p,
        "status",
        ["scheduled", "postponed", "played", "cancelled"],
        "scheduled",
      );
      f.startsAt = date(p, "startsAt", true);
      f.location = text(p, "location", 200);
      f.status = status;
      f.homeScore = status === "played" ? number(p, "homeScore", 0, 99) : null;
      f.awayScore = status === "played" ? number(p, "awayScore", 0, 99) : null;
      f.attachmentIds = attachments(p, files);
      if (f.eventId) {
        const e = core.events.find((e) => e.id === f.eventId);
        if (e) {
          const home = get(c.teams, f.homeId);
          e.starts_at = f.startsAt;
          e.location = f.location;
          e.is_cancelled = status === "cancelled";
          e.score_for = home.internalTeamId ? f.homeScore : f.awayScore;
          e.score_against = home.internalTeamId ? f.awayScore : f.homeScore;
        }
      }
      return entityAudit(state, actor, type, c.id, "Résultat ou calendrier mis à jour");
    }
    case "competition.finish": {
      const c = get(flow.competitions, entityId);
      if (
        c.status !== "active" ||
        c.fixtures.some((f) => !["played", "cancelled"].includes(f.status))
      )
        throw new WorkflowError("Toutes les rencontres doivent être jouées ou annulées.");
      c.status = "finished";
      return entityAudit(state, actor, type, c.id, "Championnat clôturé");
    }
    default:
      throw new WorkflowError("Action inconnue.", 400, "unknown_action");
  }
}
export function syncCoreTasks(state: WorkspaceState) {
  for (const task of state.flow.workTasks) {
    if (task.assignmentId && !state.core.assignments.some((a) => a.id === task.assignmentId)) {
      task.assignmentId = "";
      if (task.status !== "done") task.status = "cancelled";
    }
    if (task.memberId && !state.core.members.some((m) => m.id === task.memberId))
      task.memberId = "";
  }
  for (const a of state.core.assignments) {
    if (state.flow.workTasks.some((t) => t.assignmentId === a.id)) continue;
    const e = state.core.events.find((e) => e.id === a.event_id);
    if (!e) continue;
    state.flow.workTasks.push({
      id: uid(),
      title: a.task.name,
      description: "Tâche attribuée depuis la fiche événement.",
      teamId: a.task.team_id,
      eventId: a.event_id,
      memberId: a.member.id,
      dueAt: e.meeting_at || e.starts_at,
      priority: "normal",
      status: "todo",
      checklist: [],
      attachmentIds: [],
      requireProof: false,
      comments: [],
      createdAt: iso(),
      assignmentId: a.id,
    });
  }
}
export function blankFlow(): FlowState {
  return {
    schemaVersion: 1,
    campaigns: [],
    deliveries: [],
    conversations: [],
    sponsors: [],
    placements: [],
    collections: [],
    charges: [],
    transactions: [],
    workTasks: [],
    competitions: [],
    profiles: [],
    audit: [],
    settings: { deliveryMode: "realistic", simulation: true },
  };
}
