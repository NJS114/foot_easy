import { useState, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  Mail,
  Copy,
  Pause,
  Play,
  Send,
  Download,
  FlaskConical,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Campaign, Channel, Delivery, WorkspaceView } from "./types";
import { useAction, datetime, downloadCSV } from "./client";
import { personalize, targetDestination } from "./domain";
import {
  Page,
  Workspace,
  Panel,
  Metrics,
  Field,
  Select,
  Textarea,
  Feedback,
  Empty,
  SearchBox,
  Status,
  labels,
  AuditTrail,
  ConfirmButton,
} from "./ui";
import { AttachmentPicker, Attachments, DocumentPanel } from "./Documents";

export function CampaignsPage() {
  return <Workspace>{(data) => <Campaigns data={data} />}</Workspace>;
}
function Campaigns({ data }: { data: WorkspaceView }) {
  const [params, setParams] = useSearchParams();
  const eventFilter = params.get("eventId") || "";
  const sponsorId = params.get("sponsorId") || "";
  const [newCampaign, setNew] = useState(params.has("new")),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const list = data.flow.campaigns.filter(
    (c) =>
      (!eventFilter || c.eventId === eventFilter) &&
      (!filter || c.status === filter) &&
      c.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Page
      title="Campagnes & envois"
      description="Emails, SMS, notifications et publicités, du brouillon au suivi par destinataire."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/settings">
              <FlaskConical />
              Simulateur
            </Link>
          </Button>
          <Button onClick={() => setNew(true)}>
            <Plus />
            Créer une campagne
          </Button>
        </>
      }
    >
      <Metrics
        items={[
          { label: "Campagnes", value: data.flow.campaigns.length },
          {
            label: "Programmées",
            value: data.flow.campaigns.filter((c) => c.status === "scheduled").length,
          },
          {
            label: "Distribués · simulation",
            value: data.flow.deliveries.filter((d) =>
              ["delivered", "opened", "clicked"].includes(d.status),
            ).length,
          },
          {
            label: "Échecs à traiter",
            value: data.flow.deliveries.filter((d) => ["failed", "bounced"].includes(d.status))
              .length,
          },
        ]}
      />
      <div className="flow-toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <Select
          label="État de la campagne"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Toutes les campagnes</option>
          {["draft", "scheduled", "running", "paused", "completed", "cancelled"].map((s) => (
            <option value={s} key={s}>
              {labels[s]}
            </option>
          ))}
        </Select>
      </div>
      <Panel>
        {list.length ? (
          <div className="flow-table-wrap">
            <table className="flow-table">
              <thead>
                <tr>
                  <th>Campagne</th>
                  <th>Canal / objectif</th>
                  <th>Destinataires</th>
                  <th>État</th>
                  <th>Programmation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="flow-link strong" to={`/campaigns/${c.id}`}>
                        {c.name}
                      </Link>
                      <small>{c.subject || "Objet à compléter"}</small>
                    </td>
                    <td>
                      {labels[c.channel]}
                      <small>{labels[c.kind]}</small>
                    </td>
                    <td>{c.memberIds.length}</td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>{c.scheduledAt ? datetime(c.scheduledAt) : "Envoi immédiat"}</td>
                    <td>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/campaigns/${c.id}`}>Ouvrir</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty action={<Button onClick={() => setNew(true)}>Préparer un premier envoi</Button>}>
            Aucune campagne dans cette vue.
          </Empty>
        )}
      </Panel>
      {newCampaign && (
        <CampaignEditor
          data={data}
          initial={{
            eventId: eventFilter,
            sponsorId,
            ...(sponsorId ? { kind: "advertising" as const } : {}),
          }}
          onClose={() => {
            setNew(false);
            if (params.has("new")) {
              params.delete("new");
              setParams(params);
            }
          }}
          onSaved={(id) => navigate(`/campaigns/${id}`)}
        />
      )}
    </Page>
  );
}

const newDraft = (): Omit<Campaign, "id"> => ({
  name: "",
  kind: "information",
  channel: "email",
  subject: "",
  body: "",
  memberIds: [],
  attachmentIds: [],
  status: "draft",
  scheduledAt: null,
  startedAt: null,
  createdAt: new Date().toISOString(),
  eventId: "",
  sponsorId: "",
  ctaLabel: "",
  ctaUrl: "",
  audienceFrozen: false,
});
export function CampaignEditor({
  data,
  campaign,
  initial,
  onClose,
  onSaved,
}: {
  data: WorkspaceView;
  campaign?: Campaign;
  initial?: Partial<Campaign>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const action = useAction();
  const [draft, setDraft] = useState(
      campaign ? structuredClone(campaign) : { ...newDraft(), ...initial },
    ),
    [step, setStep] = useState(0),
    [team, setTeam] = useState(""),
    [search, setSearch] = useState(""),
    [schedule, setSchedule] = useState(""),
    [delivery, setDelivery] = useState<"draft" | "now" | "later">("draft"),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const patch = (value: Partial<Campaign>) => setDraft((d) => ({ ...d, ...value }));
  const filtered = data.core.members.filter(
    (m) =>
      (!team || m.team_id === team) &&
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const flow = { ...data.flow, profiles: data.flow.profiles.map((p) => ({ ...p })) };
  const audience = draft.memberIds.map((id) =>
    targetDestination(data.core, flow, id, draft.channel, draft.kind === "advertising"),
  );
  const eligible = audience.filter((x) => !x.reason).length;
  const previewId = draft.memberIds[0] || data.core.members[0]?.id;
  const savedId = useRef(campaign?.id);
  async function save(mode = delivery) {
    setError(null);
    if (!draft.name.trim()) {
      setStep(0);
      setError(new Error("Donnez un nom à la campagne."));
      return;
    }
    if (
      mode !== "draft" &&
      (!draft.body.trim() ||
        !draft.memberIds.length ||
        (draft.channel === "email" && !draft.subject.trim()))
    ) {
      setError(new Error("Complétez le contenu et les destinataires avant de lancer."));
      return;
    }
    if (mode === "later" && (!schedule || new Date(schedule) <= new Date())) {
      setError(new Error("Choisissez une date de programmation future."));
      return;
    }
    setBusy(true);
    try {
      const result = await action.mutateAsync({
        type: "campaign.save",
        payload: { ...draft, id: savedId.current },
      });
      savedId.current = result.entityId;
      if (mode === "now")
        await action.mutateAsync({ type: "campaign.start", payload: { id: result.entityId } });
      if (mode === "later")
        await action.mutateAsync({
          type: "campaign.schedule",
          payload: { id: result.entityId, scheduledAt: new Date(schedule).toISOString() },
        });
      onSaved(result.entityId);
      onClose();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={campaign ? "Modifier le brouillon" : "Créer une campagne"} onClose={onClose} wide>
      <ol className="flow-stepper">
        {["Préparer", "Destinataires", "Contenu", "Vérifier"].map((label, i) => (
          <li key={label} className={step === i ? "current" : step > i ? "complete" : ""}>
            <button type="button" onClick={() => setStep(i)}>
              <span>{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="flow-form">
        {step === 0 && (
          <>
            <div className="flow-form-grid">
              <Field
                label="Nom de la campagne"
                required
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                maxLength={160}
              />
              <Select
                label="Objectif"
                value={draft.kind}
                onChange={(e) => patch({ kind: e.target.value as Campaign["kind"] })}
              >
                {["information", "invitation", "reminder", "advertising"].map((v) => (
                  <option key={v} value={v}>
                    {labels[v]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="channel-grid">
              {(["email", "sms", "push", "inapp"] as Channel[]).map((channel) => (
                <button
                  type="button"
                  key={channel}
                  className={draft.channel === channel ? "selected" : ""}
                  onClick={() => patch({ channel })}
                >
                  <Mail size={22} />
                  <strong>{labels[channel]}</strong>
                  <small>
                    {channel === "sms"
                      ? "Messages courts"
                      : channel === "email"
                        ? "Objet, contenu et pièces jointes"
                        : channel === "push"
                          ? "Notification sur appareil"
                          : "Message dans l’espace membre"}
                  </small>
                </button>
              ))}
            </div>
            <div className="flow-info">
              <FlaskConical size={19} />
              <p>
                Mode simulation : les statuts et les délais sont testables, sans contacter de
                destinataire.
              </p>
            </div>
            {draft.kind === "advertising" && (
              <Select
                label="Partenaire mis en avant"
                value={draft.sponsorId}
                onChange={(e) => patch({ sponsorId: e.target.value })}
              >
                <option value="">Choisir un sponsor</option>
                {data.flow.sponsors
                  .filter((s) => !s.archived)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            )}
            <Select
              label="Événement associé (facultatif)"
              value={draft.eventId}
              onChange={(e) => patch({ eventId: e.target.value })}
            >
              <option value="">Aucun événement</option>
              {data.core.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {datetime(e.starts_at)}
                </option>
              ))}
            </Select>
          </>
        )}
        {step === 1 && (
          <>
            <div className="flow-form-grid">
              <Select
                label="Filtrer une équipe"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              >
                <option value="">Tout le club</option>
                {data.core.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <SearchBox value={search} onChange={setSearch} />
            </div>
            <div className="flow-row">
              <strong>
                {draft.memberIds.length} sélectionnés · {eligible} joignables
              </strong>
              <div className="flow-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({
                      memberIds: [...new Set([...draft.memberIds, ...filtered.map((m) => m.id)])],
                    })
                  }
                >
                  Sélectionner la liste
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => patch({ memberIds: [] })}
                >
                  Tout désélectionner
                </Button>
              </div>
            </div>
            <div className="audience-list">
              {filtered.map((m) => {
                const target = targetDestination(
                  data.core,
                  flow,
                  m.id,
                  draft.channel,
                  draft.kind === "advertising",
                );
                return (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      checked={draft.memberIds.includes(m.id)}
                      onChange={(e) =>
                        patch({
                          memberIds: e.target.checked
                            ? [...draft.memberIds, m.id]
                            : draft.memberIds.filter((x) => x !== m.id),
                        })
                      }
                    />
                    <span className="member-avatar">
                      {m.first_name[0]}
                      {m.last_name[0]}
                    </span>
                    <span>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                      <small>{target.destination || "Coordonnée manquante"}</small>
                    </span>
                    {target.reason && <span className="flow-danger">{target.reason}</span>}
                  </label>
                );
              })}
            </div>
            <p className="flow-muted">
              Les contacts invalides et les personnes désinscrites sont conservés dans le rapport
              avec un motif d’exclusion. Les campagnes publicitaires respectent les accords
              renseignés dans les dossiers.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <Select
              label="Partir d’un modèle"
              defaultValue=""
              onChange={(e) => {
                const templates: Record<string, { subject: string; body: string }> = {
                  season: {
                    subject: "{{club}} · Informations de la saison",
                    body: "Bonjour {{prenom}},\n\nRetrouvez les informations de {{equipe}} dans votre espace club.\n\nÀ bientôt sur le terrain !",
                  },
                  match: {
                    subject: "Votre prochaine convocation",
                    body: "Bonjour {{prenom}},\n\nMerci de confirmer votre disponibilité pour le prochain événement de {{equipe}}. Les documents pratiques sont joints.\n\nLe staff",
                  },
                  sponsor: {
                    subject: "Découvrez notre partenaire",
                    body: "Bonjour {{prenom}},\n\n{{club}} vous présente son partenaire et son offre pour les membres. Retrouvez les détails ci-dessous.\n\nVous pouvez modifier vos préférences de communication dans votre dossier.",
                  },
                  reminder: {
                    subject: "Petit rappel de votre club",
                    body: "Bonjour {{prenom}},\n\nUne action reste à compléter dans votre espace {{club}}. Merci de faire le nécessaire.\n\nLe club",
                  },
                };
                if (templates[e.target.value]) patch(templates[e.target.value]);
              }}
            >
              <option value="">Écrire mon contenu</option>
              <option value="season">Informations de saison</option>
              <option value="match">Convocation</option>
              <option value="sponsor">Offre partenaire</option>
              <option value="reminder">Relance</option>
            </Select>
            {draft.channel === "email" && (
              <Field
                label="Objet de l’email"
                required
                value={draft.subject}
                onChange={(e) => patch({ subject: e.target.value })}
                maxLength={200}
              />
            )}
            <Textarea
              label="Message"
              required
              rows={8}
              maxLength={draft.channel === "sms" ? 1600 : 20000}
              value={draft.body}
              onChange={(e) => patch({ body: e.target.value })}
            />
            <p className="flow-muted">
              Personnalisation : {"{{prenom}}, {{nom}}, {{equipe}}, {{club}}"} · {draft.body.length}{" "}
              caractères
            </p>
            <div className="flow-form-grid">
              <Field
                label="Libellé du lien"
                value={draft.ctaLabel}
                onChange={(e) => patch({ ctaLabel: e.target.value })}
              />
              <Field
                label="Adresse du lien"
                type="url"
                value={draft.ctaUrl}
                onChange={(e) => patch({ ctaUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <AttachmentPicker
              data={data}
              selected={draft.attachmentIds}
              onChange={(ids) => patch({ attachmentIds: ids })}
            />
          </>
        )}
        {step === 3 && (
          <>
            <div className="flow-two-columns">
              <div>
                <h3 className="flow-section-title">Aperçu personnalisé</h3>
                <div className={`message-preview preview-${draft.channel}`}>
                  <small>
                    {labels[draft.channel]} · {data.core.clubs[0].name}
                  </small>
                  {draft.subject && <h3>{personalize(draft.subject, data.core, previewId)}</h3>}
                  <p>
                    {personalize(draft.body, data.core, previewId) ||
                      "Votre message apparaîtra ici."}
                  </p>
                  <Attachments ids={draft.attachmentIds} data={data} />
                  {draft.ctaLabel && <span className="preview-cta">{draft.ctaLabel}</span>}
                </div>
              </div>
              <div className="flow-form">
                <Metrics
                  items={[
                    { label: "Sélectionnés", value: audience.length },
                    { label: "Joignables", value: eligible },
                    { label: "Exclus", value: audience.length - eligible },
                  ]}
                />
                <Select
                  label="Suite du parcours"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value as typeof delivery)}
                >
                  <option value="draft">Conserver en brouillon</option>
                  <option value="now">Lancer la simulation maintenant</option>
                  <option value="later">Programmer la simulation</option>
                </Select>
                {delivery === "later" && (
                  <Field
                    label="Date et heure locales"
                    type="datetime-local"
                    required
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  />
                )}
                <p className="flow-muted">
                  Vous pourrez consulter chaque statut, mettre en pause, annuler les envois restants
                  ou relancer les échecs. L’audience est figée au lancement. Une programmation est
                  exécutée à la prochaine consultation après l’heure prévue dans ce simulateur.
                </p>
              </div>
            </div>
          </>
        )}
        <Feedback error={error || action.error} />
        <div className="flow-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Précédent
            </Button>
          )}
          {step < 3 ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void save("draft");
                }}
              >
                Enregistrer le brouillon
              </Button>
              <Button type="button" onClick={() => setStep(step + 1)}>
                Continuer
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={() => void save()}>
              {busy
                ? "Enregistrement…"
                : delivery === "now"
                  ? "Lancer la simulation"
                  : delivery === "later"
                    ? "Programmer"
                    : "Enregistrer le brouillon"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function CampaignDetailPage() {
  const { campaignId = "" } = useParams();
  return <Workspace>{(data) => <CampaignDetail data={data} campaignId={campaignId} />}</Workspace>;
}
function CampaignDetail({ data, campaignId }: { data: WorkspaceView; campaignId: string }) {
  const campaign = data.flow.campaigns.find((c) => c.id === campaignId);
  const action = useAction(),
    navigate = useNavigate();
  const [edit, setEdit] = useState(false),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [inspect, setInspect] = useState<string | null>(null),
    [schedule, setSchedule] = useState(false),
    [at, setAt] = useState("");
  if (!campaign)
    return (
      <Empty>
        Campagne introuvable. <Link to="/campaigns">Revenir aux campagnes</Link>
      </Empty>
    );
  const deliveries = data.flow.deliveries.filter((d) => d.campaignId === campaign.id);
  const shown = deliveries.filter(
    (d) =>
      (!filter || d.status === filter) &&
      `${d.name} ${d.destination}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = deliveries.find((d) => d.id === inspect);
  const send = (type: string, payload: Record<string, unknown> = {}) =>
    action.mutateAsync({ type, payload: { id: campaign.id, ...payload } });
  const success = deliveries.filter((d) =>
    ["delivered", "opened", "clicked"].includes(d.status),
  ).length;
  return (
    <Page
      title={campaign.name}
      description={`${labels[campaign.channel]} · ${labels[campaign.kind]} · Simulation des envois`}
      back="/campaigns"
      actions={
        <>
          <Status value={campaign.status} />
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={async () => {
              try {
                const r = await send("campaign.duplicate");
                navigate(`/campaigns/${r.entityId}`);
              } catch {
                /* feedback */
              }
            }}
          >
            <Copy />
            Dupliquer
          </Button>
          {campaign.status === "draft" && <Button onClick={() => setEdit(true)}>Modifier</Button>}
        </>
      }
    >
      <Feedback error={action.error} success={action.data?.message} />
      <Metrics
        items={[
          { label: "Destinataires", value: campaign.memberIds.length },
          { label: "Distribués", value: success, detail: "Statuts simulés" },
          {
            label: "Lus",
            value: deliveries.filter((d) => ["opened", "clicked"].includes(d.status)).length,
          },
          {
            label: "Échecs / rejets",
            value: deliveries.filter((d) => ["failed", "bounced"].includes(d.status)).length,
          },
        ]}
      />
      <Panel
        title="Piloter l’envoi"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void send("campaign.test").catch(() => {})}
              disabled={action.isPending}
            >
              <FlaskConical />
              Tester
            </Button>
            {campaign.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => setSchedule(true)}>
                  <Clock />
                  Programmer
                </Button>
                <ConfirmButton
                  label={
                    <>
                      <Send />
                      Lancer la simulation
                    </>
                  }
                  title="Lancer cette campagne ?"
                  pending={action.isPending}
                  onConfirm={() => send("campaign.start")}
                >
                  Les {campaign.memberIds.length} destinataires seront évalués et les statuts
                  progresseront en simulation. Aucun email, SMS ou push réel ne sera envoyé.
                </ConfirmButton>
              </>
            )}
            {campaign.status === "running" && (
              <Button variant="outline" onClick={() => void send("campaign.pause").catch(() => {})}>
                <Pause />
                Pause
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button onClick={() => void send("campaign.resume").catch(() => {})}>
                <Play />
                Reprendre
              </Button>
            )}
            {["running", "paused", "scheduled", "draft"].includes(campaign.status) && (
              <ConfirmButton
                label="Annuler"
                title="Annuler les envois restants ?"
                pending={action.isPending}
                onConfirm={() => send("campaign.cancel")}
              >
                Les destinataires déjà distribués restent dans l’historique. Les envois en attente
                seront annulés.
              </ConfirmButton>
            )}
            {deliveries.some((d) => ["failed", "bounced"].includes(d.status)) && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => void send("campaign.retry").catch(() => {})}
              >
                <RotateCcw />
                Relancer les échecs
              </Button>
            )}
          </>
        }
      >
        <div className="flow-row">
          <span>Créée le {datetime(campaign.createdAt)}</span>
          <span>
            {campaign.scheduledAt
              ? `Programmée le ${datetime(campaign.scheduledAt)}`
              : campaign.startedAt
                ? `Démarrée le ${datetime(campaign.startedAt)}`
                : "Le brouillon peut encore être modifié."}
          </span>
        </div>
        <div className="flow-progress">
          <span
            style={{
              width: `${deliveries.length ? (100 * deliveries.filter((d) => !["queued", "sending"].includes(d.status)).length) / deliveries.length : 0}%`,
            }}
          />
        </div>
      </Panel>
      <Tabs defaultValue="tracking">
        <TabsList>
          <TabsTrigger value="tracking">Suivi des destinataires</TabsTrigger>
          <TabsTrigger value="content">Contenu et fichiers</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="tracking">
          <Panel
            title="Journal de distribution"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV("suivi-campagne.csv", [
                    [
                      "Destinataire",
                      "Adresse",
                      "Canal",
                      "Statut simulé",
                      "Tentatives",
                      "Motif",
                      "Dernière activité",
                    ],
                    ...deliveries.map((d) => [
                      d.name,
                      d.destination,
                      labels[d.channel],
                      labels[d.status],
                      d.attempt,
                      d.reason,
                      d.at,
                    ]),
                  ])
                }
              >
                <Download />
                Exporter CSV
              </Button>
            }
          >
            <div className="flow-toolbar">
              <SearchBox value={search} onChange={setSearch} />
              <Select
                label="Statut de l’envoi"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                {[
                  "queued",
                  "sending",
                  "delivered",
                  "opened",
                  "clicked",
                  "failed",
                  "bounced",
                  "unsubscribed",
                  "excluded",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </Select>
            </div>
            {shown.length ? (
              <div className="flow-table-wrap">
                <table className="flow-table">
                  <thead>
                    <tr>
                      <th>Destinataire</th>
                      <th>Statut</th>
                      <th>Tentatives</th>
                      <th>Dernière activité</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.name}</strong>
                          <small>{d.destination || "Coordonnée absente"}</small>
                        </td>
                        <td>
                          <Status value={d.status} />
                          <small>{d.reason}</small>
                        </td>
                        <td>{d.attempt} / 5</td>
                        <td>{datetime(d.at)}</td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => setInspect(d.id)}>
                            Détail
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                {deliveries.length
                  ? "Aucun destinataire dans ce filtre."
                  : "Le suivi sera créé au lancement de la campagne."}
              </Empty>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="content">
          <Panel title={campaign.subject || "Message"}>
            <p className="flow-message-text">
              {personalize(campaign.body, data.core, campaign.memberIds[0])}
            </p>
            <Attachments ids={campaign.attachmentIds} data={data} />
            {campaign.ctaUrl && (
              <a className="flow-link" href={campaign.ctaUrl} target="_blank" rel="noreferrer">
                {campaign.ctaLabel || campaign.ctaUrl}
              </a>
            )}
          </Panel>
          <DocumentPanel data={data} entityType="campaign" entityId={campaign.id} />
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Historique de la campagne">
            <AuditTrail data={data} entityId={campaign.id} />
          </Panel>
        </TabsContent>
      </Tabs>
      {edit && (
        <CampaignEditor
          data={data}
          campaign={campaign}
          onClose={() => setEdit(false)}
          onSaved={() => {}}
        />
      )}
      {schedule && (
        <Modal title="Programmer la simulation" onClose={() => setSchedule(false)}>
          <form
            className="flow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send("campaign.schedule", { scheduledAt: new Date(at).toISOString() });
                setSchedule(false);
              } catch {
                /* kept */
              }
            }}
          >
            <Field
              label="Date et heure locales"
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              required
            />
            <Feedback error={action.error} />
            <Button disabled={action.isPending}>Programmer</Button>
          </form>
        </Modal>
      )}
      {selected && <DeliveryDetail delivery={selected} onClose={() => setInspect(null)} />}
    </Page>
  );
}
function DeliveryDetail({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const action = useAction();
  return (
    <Modal title={`Suivi · ${delivery.name}`} onClose={onClose}>
      <div className="flow-row">
        <Status value={delivery.status} />
        <span>{delivery.destination}</span>
      </div>
      <ol className="flow-timeline">
        {delivery.history.map((h, i) => (
          <li key={i}>
            <span className="timeline-dot" />
            <div>
              <strong>{labels[h.status]}</strong>
              <p>{h.detail}</p>
              <small>{datetime(h.at)}</small>
            </div>
          </li>
        ))}
      </ol>
      {!["excluded", "cancelled"].includes(delivery.status) && (
        <div className="flow-form">
          <Select
            label="Tester un retour du fournisseur"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                action.mutate({
                  type: "delivery.outcome",
                  payload: { id: delivery.id, outcome: e.target.value },
                });
            }}
          >
            <option value="">Choisir un événement simulé</option>
            {["delivered", "opened", "clicked", "failed", "bounced", "unsubscribed"].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </Select>
          <Feedback error={action.error} success={action.data?.message} />
        </div>
      )}
    </Modal>
  );
}
