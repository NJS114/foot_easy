import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Megaphone, ExternalLink, Archive, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Placement, Sponsor, WorkspaceView } from "./types";
import { useAction, useWorkspace, euros, shortDate } from "./client";
import {
  Page,
  Workspace,
  Panel,
  Metrics,
  Field,
  Select,
  Textarea,
  Feedback,
  FormActions,
  Empty,
  SearchBox,
  Status,
  labels,
  AuditTrail,
  ConfirmButton,
} from "./ui";
import { AttachmentPicker, Attachments, DocumentPanel } from "./Documents";

export function SponsorsPage() {
  return <Workspace>{(data) => <Sponsors data={data} />}</Workspace>;
}
function Sponsors({ data }: { data: WorkspaceView }) {
  const [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    [stage, setStage] = useState(""),
    [archived, setArchived] = useState(false);
  const navigate = useNavigate();
  const list = data.flow.sponsors.filter(
    (s) =>
      s.archived === archived &&
      (!stage || s.stage === stage) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Page
      title="Sponsors & partenaires"
      description="Prospection, contrats, visuels et campagnes partenaires."
      actions={
        <Button onClick={() => setCreate(true)}>
          <Plus />
          Ajouter un partenaire
        </Button>
      }
    >
      <Metrics
        items={[
          {
            label: "Partenaires signés",
            value: data.flow.sponsors.filter((s) => s.stage === "signed" && !s.archived).length,
          },
          {
            label: "Engagements signés",
            value: euros(
              data.flow.sponsors
                .filter((s) => s.stage === "signed" && !s.archived)
                .reduce((n, s) => n + s.amount, 0),
            ),
          },
          {
            label: "En négociation",
            value: data.flow.sponsors.filter((s) => ["proposal", "negotiation"].includes(s.stage))
              .length,
          },
          {
            label: "Publicités actives",
            value: data.flow.placements.filter((p) => p.status === "active").length,
          },
        ]}
      />
      <div className="flow-toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <Select label="Étape commerciale" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Toutes</option>
          {["prospect", "contacted", "proposal", "negotiation", "signed", "declined"].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => setArchived(!archived)}>
          {archived ? "Voir les partenaires actifs" : "Voir les archives"}
        </Button>
      </div>
      <div className="flow-card-grid">
        {list.map((s) => (
          <Link className="flow-card sponsor-card" to={`/sponsors/${s.id}`} key={s.id}>
            <div className="flow-row">
              <Logo data={data} fileId={s.logoId} name={s.name} />
              <Status value={s.level} />
            </div>
            <h2>{s.name}</h2>
            <p>{s.contact || "Contact à renseigner"}</p>
            <div className="flow-row">
              <strong>{euros(s.amount)}</strong>
              <Status value={s.stage} />
            </div>
            <small>
              {s.endDate ? `Fin du partenariat : ${shortDate(s.endDate)}` : "Période à définir"}
            </small>
          </Link>
        ))}
      </div>
      {!list.length && <Empty>Aucun partenaire ne correspond à cette sélection.</Empty>}
      {create && (
        <SponsorEditor
          data={data}
          onClose={() => setCreate(false)}
          onSaved={(id) => navigate(`/sponsors/${id}`)}
        />
      )}
    </Page>
  );
}
function Logo({ data, fileId, name }: { data: WorkspaceView; fileId: string; name: string }) {
  const file = data.files.find((f) => f.id === fileId);
  return (
    <span className="sponsor-logo">
      {file?.mime.startsWith("image/") ? (
        <img src={file.url} alt={`Logo ${name}`} />
      ) : (
        name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
function SponsorEditor({
  data,
  sponsor,
  onClose,
  onSaved,
}: {
  data: WorkspaceView;
  sponsor?: Sponsor;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const action = useAction();
  const [files, setFiles] = useState(sponsor?.attachmentIds || []),
    [logo, setLogo] = useState(sponsor?.logoId ? [sponsor.logoId] : []);
  return (
    <Modal title={sponsor ? "Modifier le partenaire" : "Nouveau partenaire"} onClose={onClose} wide>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const r = await action.mutateAsync({
              type: "sponsor.save",
              payload: {
                ...values,
                id: sponsor?.id,
                amount: Math.round(Number(values.amount) * 100),
                logoId: logo[0] || "",
                attachmentIds: files,
              },
            });
            onSaved(r.entityId);
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <div className="flow-form-grid">
          <Field
            label="Entreprise / partenaire"
            required
            name="name"
            defaultValue={sponsor?.name}
          />
          <Field label="Personne à contacter" name="contact" defaultValue={sponsor?.contact} />
          <Field label="Email" type="email" name="email" defaultValue={sponsor?.email} />
          <Field label="Téléphone" type="tel" name="phone" defaultValue={sponsor?.phone} />
          <Field
            label="Site internet"
            type="url"
            name="website"
            defaultValue={sponsor?.website}
            placeholder="https://…"
          />
          <Field
            label="Montant du partenariat (€)"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(sponsor?.amount || 0) / 100}
          />
          <Select label="Niveau" name="level" defaultValue={sponsor?.level || "bronze"}>
            {["bronze", "silver", "gold"].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </Select>
          <Select label="Étape" name="stage" defaultValue={sponsor?.stage || "prospect"}>
            {["prospect", "contacted", "proposal", "negotiation", "signed", "declined"].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </Select>
          <Field
            label="Début du partenariat"
            name="startDate"
            type="date"
            defaultValue={sponsor?.startDate}
          />
          <Field
            label="Fin du partenariat"
            name="endDate"
            type="date"
            defaultValue={sponsor?.endDate}
          />
        </div>
        <Textarea
          label="Notes, contreparties et prochaines actions"
          name="notes"
          defaultValue={sponsor?.notes}
        />
        <AttachmentPicker
          data={data}
          selected={logo}
          onChange={(ids) => setLogo(ids.slice(-1))}
          label="Logo du partenaire"
        />
        <AttachmentPicker
          data={data}
          selected={files}
          onChange={setFiles}
          label="Proposition, contrat et documents"
        />
        <Feedback error={action.error} />
        <FormActions pending={action.isPending} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function SponsorDetailPage() {
  const { sponsorId = "" } = useParams();
  return <Workspace>{(data) => <SponsorDetail data={data} id={sponsorId} />}</Workspace>;
}
function SponsorDetail({ data, id }: { data: WorkspaceView; id: string }) {
  const sponsor = data.flow.sponsors.find((s) => s.id === id);
  const action = useAction();
  const [edit, setEdit] = useState(false),
    [placement, setPlacement] = useState<Placement | null | undefined>(undefined);
  if (!sponsor) return <Empty>Partenaire introuvable.</Empty>;
  const placements = data.flow.placements.filter((p) => p.sponsorId === id),
    campaigns = data.flow.campaigns.filter((c) => c.sponsorId === id);
  return (
    <Page
      title={sponsor.name}
      back="/sponsors"
      description={`${labels[sponsor.level]} · ${labels[sponsor.stage]}`}
      actions={
        <>
          <ConfirmButton
            label={
              <>
                <Archive />
                {sponsor.archived ? "Restaurer" : "Archiver"}
              </>
            }
            title={sponsor.archived ? "Restaurer le partenaire ?" : "Archiver le partenaire ?"}
            pending={action.isPending}
            onConfirm={() => action.mutateAsync({ type: "sponsor.archive", payload: { id } })}
          >
            Les contrats et historiques seront conservés. L’archivage met en pause les publicités
            actives.
          </ConfirmButton>
          <Button onClick={() => setEdit(true)}>Modifier la fiche</Button>
        </>
      }
    >
      <Feedback error={action.error} />
      <div className="sponsor-summary">
        <Logo data={data} name={sponsor.name} fileId={sponsor.logoId} />
        <div>
          <strong>{sponsor.contact || "Contact à compléter"}</strong>
          <p>
            {sponsor.email} {sponsor.phone && ` · ${sponsor.phone}`}
          </p>
          {sponsor.website && (
            <a href={sponsor.website} target="_blank" rel="noreferrer" className="flow-link">
              Site du partenaire <ExternalLink size={14} />
            </a>
          )}
        </div>
        <div>
          <strong>{euros(sponsor.amount)}</strong>
          <p>
            {shortDate(sponsor.startDate)} — {shortDate(sponsor.endDate)}
          </p>
        </div>
      </div>
      <Tabs defaultValue="partnership">
        <TabsList>
          <TabsTrigger value="partnership">Partenariat</TabsTrigger>
          <TabsTrigger value="ads">Publicités & visuels</TabsTrigger>
          <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="partnership">
          <Panel title="Contreparties et suivi">
            <p className="flow-message-text">
              {sponsor.notes || "Ajoutez les engagements et la prochaine étape dans la fiche."}
            </p>
            <Attachments ids={sponsor.attachmentIds} data={data} />
          </Panel>
          <DocumentPanel
            data={data}
            entityType="sponsor"
            entityId={id}
            title="Contrats, logos et documents du partenaire"
          />
        </TabsContent>
        <TabsContent value="ads">
          <Panel
            title="Emplacements publicitaires"
            actions={
              <Button disabled={sponsor.archived} onClick={() => setPlacement(null)}>
                <Plus />
                Créer une publicité
              </Button>
            }
          >
            <div className="flow-card-grid">
              {placements.map((p) => (
                <article key={p.id} className="ad-card">
                  {p.imageId ? (
                    <img src={data.files.find((f) => f.id === p.imageId)?.url} alt={p.name} />
                  ) : (
                    <div className="ad-placeholder">
                      <ImageIcon />
                      <span>Visuel à ajouter</span>
                    </div>
                  )}
                  <div className="ad-card-body">
                    <div className="flow-row">
                      <h3>{p.name}</h3>
                      <Status value={p.status} />
                    </div>
                    <p>
                      {p.surface === "dashboard"
                        ? "Tableau de bord"
                        : p.surface === "calendar"
                          ? "Calendrier"
                          : "Newsletter"}{" "}
                      · {shortDate(p.startDate)} — {shortDate(p.endDate)}
                    </p>
                    <div className="ad-stats">
                      <span>
                        <strong>{p.impressions}</strong>impressions simulées
                      </span>
                      <span>
                        <strong>{p.clicks}</strong>clics simulés
                      </span>
                      <span>
                        <strong>
                          {p.impressions ? ((100 * p.clicks) / p.impressions).toFixed(1) : 0}%
                        </strong>
                        taux de clic
                      </span>
                    </div>
                    <div className="flow-actions">
                      <Button variant="outline" size="sm" onClick={() => setPlacement(p)}>
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            type: "placement.status",
                            payload: {
                              id: p.id,
                              status: p.status === "active" ? "paused" : "active",
                            },
                          })
                        }
                      >
                        {p.status === "active" ? "Mettre en pause" : "Activer"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            type: "placement.simulate",
                            payload: { id: p.id, impressions: 100, clicks: 8 },
                          })
                        }
                      >
                        Simuler 100 vues
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!placements.length && (
              <Empty>
                Ajoutez un visuel, une destination et une période pour préparer la diffusion.
              </Empty>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="campaigns">
          <Panel
            title="Communications du partenaire"
            actions={
              <Button asChild>
                <Link to={`/campaigns?new=1&sponsorId=${id}`}>
                  <Megaphone />
                  Nouvelle campagne
                </Link>
              </Button>
            }
          >
            {campaigns.length ? (
              <div className="flow-list">
                {campaigns.map((c) => (
                  <Link key={c.id} to={`/campaigns/${c.id}`}>
                    <strong>{c.name}</strong>
                    <span>{labels[c.channel]}</span>
                    <Status value={c.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>Aucune campagne liée à ce partenaire.</Empty>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Historique commercial">
            <AuditTrail data={data} entityId={id} />
          </Panel>
        </TabsContent>
      </Tabs>
      {edit && (
        <SponsorEditor
          data={data}
          sponsor={sponsor}
          onClose={() => setEdit(false)}
          onSaved={() => {}}
        />
      )}
      {placement !== undefined && (
        <PlacementEditor
          data={data}
          sponsor={sponsor}
          placement={placement || undefined}
          onClose={() => setPlacement(undefined)}
        />
      )}
    </Page>
  );
}
function PlacementEditor({
  data,
  sponsor,
  placement,
  onClose,
}: {
  data: WorkspaceView;
  sponsor: Sponsor;
  placement?: Placement;
  onClose: () => void;
}) {
  const action = useAction();
  const [image, setImage] = useState(placement?.imageId ? [placement.imageId] : []);
  return (
    <Modal title="Publicité du partenaire" onClose={onClose} wide>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await action.mutateAsync({
              type: "placement.save",
              payload: {
                ...values,
                id: placement?.id,
                sponsorId: sponsor.id,
                imageId: image[0] || "",
                budget: Math.round(Number(values.budget) * 100),
              },
            });
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <div className="flow-form-grid">
          <Field label="Nom de la publicité" name="name" required defaultValue={placement?.name} />
          <Select
            label="Emplacement"
            name="surface"
            defaultValue={placement?.surface || "dashboard"}
          >
            <option value="dashboard">Tableau de bord</option>
            <option value="calendar">Calendrier</option>
            <option value="newsletter">Newsletter</option>
          </Select>
          <Field
            label="Lien de destination"
            type="url"
            name="url"
            defaultValue={placement?.url || sponsor.website}
          />
          <Field
            label="Budget indicatif (€)"
            type="number"
            min="0"
            step="0.01"
            name="budget"
            defaultValue={(placement?.budget || 0) / 100}
          />
          <Field
            label="Début de diffusion"
            required
            type="date"
            name="startDate"
            defaultValue={placement?.startDate || new Date().toISOString().slice(0, 10)}
          />
          <Field
            label="Fin de diffusion"
            required
            type="date"
            name="endDate"
            defaultValue={placement?.endDate || sponsor.endDate}
          />
        </div>
        <AttachmentPicker
          data={data}
          selected={image}
          onChange={(ids) => setImage(ids.slice(-1))}
          label="Visuel de la publicité"
        />
        <p className="flow-muted">
          Le visuel actif apparaîtra à l’emplacement choisi dans l’aperçu du club pendant cette
          période. Les compteurs se testent séparément avec le simulateur.
        </p>
        <Feedback error={action.error} />
        <FormActions pending={action.isPending} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function SponsorBanner({ surface }: { surface: "dashboard" | "calendar" }) {
  const { data } = useWorkspace();
  if (!data) return null;
  const now = new Date().toISOString().slice(0, 10);
  const placement = data.flow.placements.find(
    (p) => p.status === "active" && p.surface === surface && p.startDate <= now && p.endDate >= now,
  );
  const image = data.files.find((f) => f.id === placement?.imageId);
  if (!placement || !image) return null;
  return (
    <aside className="sponsor-banner">
      <small>
        PARTENAIRE DU CLUB · {data.flow.sponsors.find((s) => s.id === placement.sponsorId)?.name}
      </small>
      <a href={placement.url} target="_blank" rel="noreferrer">
        <img src={image.url} alt={placement.name} />
      </a>
    </aside>
  );
}
