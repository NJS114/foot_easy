import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, Paperclip, Upload, X, History } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import type { FileRecord, WorkspaceView } from "./types";
import { api, useFileUpdate, workspaceKey, useAction, datetime, shortDate } from "./client";
import {
  Workspace,
  Page,
  Panel,
  Field,
  Select,
  Textarea,
  Checkbox,
  Feedback,
  FormActions,
  Empty,
  SearchBox,
  Status,
  Metrics,
  AuditTrail,
  formValues,
} from "./ui";

const accept = ".png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.csv,.txt";
const categories: Record<string, string> = {
  other: "Autre document",
  photo: "Photo",
  medical: "Certificat médical",
  license: "Licence",
  parental: "Autorisation parentale",
  contract: "Contrat",
  creative: "Visuel publicitaire",
  receipt: "Justificatif",
  match: "Feuille de match",
};
type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};
export function Uploader({
  entityType = "document",
  entityId = "",
  category = "other",
  onAdded,
  replacesId,
}: {
  entityType?: string;
  entityId?: string;
  category?: string;
  onAdded?: (file: FileRecord) => void;
  replacesId?: string;
}) {
  const qc = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [drag, setDrag] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busy = items.some((i) => i.status === "uploading");
  async function send(item: UploadItem) {
    setItems((rows) =>
      rows.map((r) => (r.id === item.id ? { ...r, status: "uploading", error: undefined } : r)),
    );
    try {
      if (item.file.size > 10 * 1024 * 1024) throw new Error("Maximum 10 Mo par fichier.");
      const form = new FormData();
      form.append("file", item.file);
      form.append("entityType", entityType);
      form.append("entityId", entityId);
      form.append("category", category);
      if (replacesId) form.append("replacesId", replacesId);
      controller.current = new AbortController();
      const file = await api<FileRecord>("/api/v2/files", {
        method: "POST",
        headers: { "X-Request-Id": item.id },
        body: form,
        signal: controller.current.signal,
      });
      await qc.invalidateQueries({ queryKey: workspaceKey });
      onAdded?.(file);
      setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, status: "done" } : r)));
    } catch (error) {
      setItems((rows) =>
        rows.map((r) =>
          r.id === item.id
            ? {
                ...r,
                status: "error",
                error:
                  (error as Error).name === "AbortError"
                    ? "Téléversement interrompu. Vous pouvez réessayer."
                    : (error as Error).message,
              }
            : r,
        ),
      );
    }
  }
  async function add(list: FileList | File[] | null) {
    if (!list || busy) return;
    const batch = Array.from(list)
      .slice(0, replacesId ? 1 : 12)
      .map((file) => ({ id: crypto.randomUUID(), file, status: "queued" as const }));
    setItems((rows) => [...rows, ...batch]);
    for (const item of batch) await send(item);
  }
  return (
    <div className="uploader">
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={!replacesId}
        className="sr-only"
        aria-label="Ajouter des fichiers"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={`upload-zone ${drag ? "dragging" : ""}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void add(e.dataTransfer.files);
        }}
      >
        <Upload size={23} />
        <strong>
          {replacesId
            ? "Ajouter une nouvelle version"
            : "Déposer des fichiers ou choisir sur votre appareil"}
        </strong>
        <span>Images, PDF, Word, Excel, CSV · 10 Mo par fichier</span>
      </button>
      {items.length > 0 && (
        <ul className="upload-queue">
          {items.map((item) => (
            <li key={item.id}>
              <span className="truncate">{item.file.name}</span>
              <small>
                {item.status === "done"
                  ? "Enregistré"
                  : item.status === "uploading"
                    ? "Téléversement…"
                    : item.status === "queued"
                      ? "En file"
                      : "Échec"}
              </small>
              {item.status === "done" && <Check size={16} />}{" "}
              {item.error && <p role="alert">{item.error}</p>}
              {item.status === "error" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void send(item)}
                >
                  Réessayer
                </Button>
              )}
              {item.status === "uploading" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => controller.current?.abort()}
                >
                  Interrompre
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function Attachments({ ids, data }: { ids: string[]; data: WorkspaceView }) {
  const [preview, setPreview] = useState<FileRecord | null>(null);
  const files = ids
    .map((id) => data.files.find((f) => f.id === id))
    .filter((f): f is FileRecord => !!f);
  return (
    <>
      <div className="attachment-list">
        {files.map((f) => (
          <div key={f.id} className="attachment-chip">
            {f.mime.startsWith("image/") ? (
              <button
                type="button"
                onClick={() => setPreview(f)}
                aria-label={`Aperçu de ${f.name}`}
              >
                <img src={f.url} alt={f.name} />
              </button>
            ) : (
              <FileText size={22} />
            )}
            <a href={`${f.url}?download=1`} download={f.name}>
              {f.name}
              <small>
                {Math.ceil(f.size / 1024)} Ko · v{f.version}
              </small>
            </a>
          </div>
        ))}
      </div>
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <img className="file-preview" src={preview.url} alt={preview.name} />
          <a className="flow-link" href={`${preview.url}?download=1`}>
            Télécharger l’image
          </a>
        </Modal>
      )}
    </>
  );
}
export function AttachmentPicker({
  data,
  selected,
  onChange,
  label = "Pièces jointes et images",
}: {
  data: WorkspaceView;
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false),
    [search, setSearch] = useState("");
  const selection = useRef(selected);
  selection.current = selected;
  const files = data.files
    .filter(
      (f) =>
        f.status !== "archived" &&
        f.status !== "rejected" &&
        f.name.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 50);
  return (
    <div className="attachment-picker">
      <div className="flow-row">
        <strong>
          <Paperclip size={16} />
          {label}
        </strong>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Réduire" : "Joindre un fichier"}
        </Button>
      </div>
      <Attachments ids={selected} data={data} />
      {selected.length > 0 && (
        <div className="flow-actions">
          {selected.map((id) => (
            <button
              className="flow-text-button"
              type="button"
              key={id}
              onClick={() => onChange(selected.filter((x) => x !== id))}
            >
              Retirer {data.files.find((f) => f.id === id)?.name || "le fichier"} <X size={12} />
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="attachment-browser">
          <Uploader
            entityType="draft"
            onAdded={(f) => {
              const next = [...new Set([...selection.current, f.id])];
              selection.current = next;
              onChange(next);
            }}
          />
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un fichier déjà ajouté"
          />
          <div className="file-pick-list">
            {files.map((f) => (
              <Checkbox
                key={f.id}
                label={`${f.name} · v${f.version}`}
                checked={selected.includes(f.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, f.id] : selected.filter((x) => x !== f.id),
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function FileReview({
  file,
  data,
  onClose,
}: {
  file: FileRecord;
  data: WorkspaceView;
  onClose: () => void;
}) {
  const update = useFileUpdate();
  return (
    <Modal title={file.name} onClose={onClose}>
      <Attachments ids={[file.id]} data={data} />
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await update.mutateAsync({ id: file.id, ...formValues(e.currentTarget) });
            onClose();
          } catch {
            /* preserve form */
          }
        }}
      >
        <div className="flow-form-grid">
          <Select label="Validation" name="status" defaultValue={file.status}>
            {["pending", "approved", "rejected", "archived"].map((value) => (
              <option key={value} value={value}>
                {
                  {
                    pending: "À vérifier",
                    approved: "Validé",
                    rejected: "Refusé",
                    archived: "Archivé",
                  }[value]
                }
              </option>
            ))}
          </Select>
          <Select label="Catégorie" name="category" defaultValue={file.category}>
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Field
            label="Date d’expiration"
            name="expiresAt"
            type="date"
            defaultValue={file.expiresAt || ""}
          />
        </div>
        <Textarea label="Commentaire ou motif de refus" name="note" defaultValue={file.note} />
        <Feedback error={update.error} />
        <FormActions pending={update.isPending} onClose={onClose} />
      </form>
      <hr className="my-5" />
      <h3 className="flow-section-title">
        <History size={18} />
        Versions conservées
      </h3>
      <Attachments
        ids={data.files.filter((f) => f.rootId === file.rootId).map((f) => f.id)}
        data={data}
      />
      <Uploader
        entityType={file.entityType}
        entityId={file.entityId}
        category={file.category}
        replacesId={file.id}
        onAdded={() => onClose()}
      />
    </Modal>
  );
}
export function DocumentPanel({
  data,
  entityType,
  entityId,
  title = "Documents et images",
}: {
  data: WorkspaceView;
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const [category, setCategory] = useState("other");
  const [review, setReview] = useState<FileRecord | null>(null);
  const files = data.files.filter(
    (f) => f.entityType === entityType && f.entityId === entityId && f.status !== "archived",
  );
  return (
    <Panel title={title}>
      <Select
        label="Type de document à ajouter"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {Object.entries(categories).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Uploader entityType={entityType} entityId={entityId} category={category} />
      {files.length ? (
        <div className="document-grid">
          {files.map((f) => (
            <FileCard key={f.id} file={f} onOpen={() => setReview(f)} />
          ))}
        </div>
      ) : (
        <Empty>Ajoutez une photo, un document ou un justificatif à ce dossier.</Empty>
      )}
      {review && <FileReview file={review} data={data} onClose={() => setReview(null)} />}
    </Panel>
  );
}
function FileCard({ file, onOpen }: { file: FileRecord; onOpen: () => void }) {
  const expired = !!file.expiresAt && file.expiresAt < new Date().toISOString().slice(0, 10);
  return (
    <article className="document-card">
      <button className="document-thumb" type="button" onClick={onOpen}>
        {file.mime.startsWith("image/") ? (
          <img src={file.url} alt={file.name} />
        ) : (
          <FileText size={38} />
        )}
      </button>
      <button className="document-title" onClick={onOpen}>
        {file.name}
      </button>
      <small>
        {categories[file.category] || file.category} · {Math.ceil(file.size / 1024)} Ko · version{" "}
        {file.version}
      </small>
      <div className="flow-row">
        <Status value={file.status} />
        {expired && <span className="flow-danger">Expiré</span>}
        <a href={`${file.url}?download=1`} aria-label={`Télécharger ${file.name}`}>
          <Download size={16} />
        </a>
      </div>
      {file.expiresAt && <small>Échéance : {shortDate(file.expiresAt)}</small>}
      <small>{datetime(file.createdAt)}</small>
    </article>
  );
}
export function DocumentsPage() {
  return <Workspace>{(data) => <Documents data={data} />}</Workspace>;
}
function Documents({ data }: { data: WorkspaceView }) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [review, setReview] = useState<FileRecord | null>(null);
  const files = data.files.filter(
    (f) => f.name.toLowerCase().includes(search.toLowerCase()) && (!filter || f.status === filter),
  );
  return (
    <Page
      title="Documents & médias"
      description="Les fichiers du club, leur validation et leurs versions."
    >
      <Metrics
        items={[
          { label: "Fichiers", value: data.files.length },
          { label: "À vérifier", value: data.files.filter((f) => f.status === "pending").length },
          { label: "Validés", value: data.files.filter((f) => f.status === "approved").length },
          {
            label: "Expirés",
            value: data.files.filter(
              (f) => f.expiresAt && f.expiresAt < new Date().toISOString().slice(0, 10),
            ).length,
          },
        ]}
      />
      <Panel title="Ajouter au club">
        <Uploader entityType="club" entityId={data.core.clubs[0].id} />
      </Panel>
      <div className="flow-toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <Select label="Statut" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous</option>
          <option value="pending">À vérifier</option>
          <option value="approved">Validés</option>
          <option value="rejected">Refusés</option>
          <option value="archived">Archivés</option>
        </Select>
      </div>
      {files.length ? (
        <div className="document-grid">
          {files.map((f) => (
            <FileCard key={f.id} file={f} onOpen={() => setReview(f)} />
          ))}
        </div>
      ) : (
        <Empty>Aucun document ne correspond à cette recherche.</Empty>
      )}
      {review && <FileReview file={review} data={data} onClose={() => setReview(null)} />}
    </Page>
  );
}
export function MemberDossierPage() {
  const { memberId = "" } = useParams();
  return (
    <Workspace>
      {(data) => <MemberDossier key={memberId} data={data} memberId={memberId} />}
    </Workspace>
  );
}
function MemberDossier({ data, memberId }: { data: WorkspaceView; memberId: string }) {
  const member = data.core.members.find((m) => m.id === memberId);
  const action = useAction();
  const current = data.flow.profiles.find((p) => p.memberId === memberId);
  const [photo, setPhoto] = useState(current?.photoId ? [current.photoId] : []);
  if (!member)
    return (
      <Empty>
        Ce membre n’existe plus. <Link to="/members">Revenir à l’annuaire</Link>
      </Empty>
    );
  const docs = data.files.filter((f) => f.entityType === "member" && f.entityId === memberId);
  return (
    <Page
      title={`${member.first_name} ${member.last_name}`}
      back="/members"
      description={`${data.core.teams.find((t) => t.id === member.team_id)?.name} · Dossier membre`}
    >
      <div className="flow-two-columns">
        <Panel title="Coordonnées et licence">
          <MemberCreateForm teamId={member.team_id} member={member} />
        </Panel>
        <Panel title="Dossier et préférences">
          <form
            className="flow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const values = formValues(form);
              action.mutate({
                type: "profile.save",
                payload: {
                  ...values,
                  id: memberId,
                  photoId: photo[0] || "",
                  emailConsent: values.emailConsent === "on",
                  smsConsent: values.smsConsent === "on",
                  optedOut: values.optedOut === "on",
                },
              });
            }}
          >
            <AttachmentPicker
              data={data}
              selected={photo}
              onChange={(ids) => setPhoto(ids.slice(-1))}
              label="Photo de profil"
            />
            <Field
              label="Responsable légal / personne à contacter"
              name="guardian"
              defaultValue={current?.guardian}
            />
            <Field
              label="Téléphone d’urgence"
              name="emergencyPhone"
              type="tel"
              defaultValue={current?.emergencyPhone}
            />
            <Textarea label="Notes du dossier" name="notes" defaultValue={current?.notes} />
            <Checkbox
              label="Accord pour les campagnes publicitaires par email"
              name="emailConsent"
              defaultChecked={current?.emailConsent}
            />
            <Checkbox
              label="Accord pour les campagnes publicitaires par SMS"
              name="smsConsent"
              defaultChecked={current?.smsConsent}
            />
            <Checkbox
              label="Désinscrit des campagnes publicitaires"
              name="optedOut"
              defaultChecked={current?.optedOut}
            />
            <Feedback error={action.error} success={action.data?.message} />
            <Button disabled={action.isPending}>Enregistrer le dossier</Button>
          </form>
        </Panel>
      </div>
      <Metrics
        items={[
          { label: "Documents", value: docs.length },
          { label: "À valider", value: docs.filter((f) => f.status === "pending").length },
          { label: "Licence", value: member.license_number ? "Renseignée" : "À compléter" },
          { label: "Photo", value: current?.photoId ? "Ajoutée" : "À ajouter" },
        ]}
      />
      <DocumentPanel
        data={data}
        entityType="member"
        entityId={memberId}
        title="Licence, certificat et pièces du dossier"
      />
      <Panel title="Historique du dossier">
        <AuditTrail data={data} entityId={memberId} />
      </Panel>
    </Page>
  );
}
