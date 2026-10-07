import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, Paperclip, Upload, X, History } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import type { FileRecord, WorkspaceView } from "./types";
import { DocumentLibrary } from "./DocumentLibrary";
import { FolderOptions } from "./DocumentFolders";
import { DocumentDownload } from "./DocumentDownload";
import { latestFiles, memberFiles, licenseStatus, folderPath } from "./document-utils";
import { LicenseReminder } from "./Users";
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
  person,
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
  metadata: Record<string, string>;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};
export function Uploader({
  entityType = "document",
  entityId = "",
  category = "other",
  onAdded,
  replacesId,
  folderId = "",
  submittedByMemberId = "",
  recipientMemberIds = [],
}: {
  entityType?: string;
  entityId?: string;
  category?: string;
  onAdded?: (file: FileRecord) => void;
  replacesId?: string;
  folderId?: string;
  submittedByMemberId?: string;
  recipientMemberIds?: string[];
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
      for (const [key, value] of Object.entries(item.metadata)) form.append(key, value);
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
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        metadata: {
          entityType,
          entityId,
          category,
          folderId,
          submittedByMemberId,
          recipientMemberIds: JSON.stringify(recipientMemberIds),
          ...(replacesId ? { replacesId } : {}),
        },
        status: "queued" as const,
      }));
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
  const [recipients, setRecipients] = useState(file.recipientMemberIds || []);
  const [entityType, setEntityType] = useState(file.entityType);
  const destinations =
    entityType === "member"
      ? data.core.members.map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }))
      : entityType === "event"
        ? data.core.events.map((e) => ({ id: e.id, name: e.title }))
        : entityType === "task"
          ? data.flow.workTasks.map((t) => ({ id: t.id, name: t.title }))
          : entityType === "club"
            ? data.core.clubs
            : [];
  return (
    <Modal title={file.name} onClose={onClose}>
      <Attachments ids={[file.id]} data={data} />
      <p className="flow-muted">
        Ajouté par : {file.uploadedBy || "Historique antérieur"} · {datetime(file.createdAt)}
        <br />
        Dossier :{" "}
        {folderPath(data.flow.folders || [], file.folderId)
          .map((f) => f.name)
          .join(" / ") || "Racine"}
      </p>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await update.mutateAsync({
              id: file.id,
              ...formValues(e.currentTarget),
              recipientMemberIds: recipients,
            });
            onClose();
          } catch {
            /* preserve form */
          }
        }}
      >
        <div className="flow-form-grid">
          <Select label="Dossier de classement" name="folderId" defaultValue={file.folderId || ""}>
            <FolderOptions data={data} />
          </Select>
          <Select
            label="Transmis par le membre (déclaré)"
            name="submittedByMemberId"
            defaultValue={file.submittedByMemberId || ""}
          >
            <option value="">Non renseigné</option>
            {data.core.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </Select>
          <Select
            label="Rattacher à"
            name="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            {[...new Set([file.entityType, "document", "club", "member", "event", "task"])].map(
              (type) => (
                <option key={type} value={type}>
                  {(
                    {
                      document: "Document du club",
                      club: "Club",
                      member: "Membre",
                      event: "Événement",
                      task: "Tâche",
                    } as Record<string, string>
                  )[type] || type}
                </option>
              ),
            )}
          </Select>
          {destinations.length ? (
            <Select
              key={entityType}
              label="Destination"
              name="entityId"
              defaultValue={entityType === file.entityType ? file.entityId : destinations[0]?.id}
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          ) : (
            <input
              type="hidden"
              name="entityId"
              value={entityType === file.entityType ? file.entityId : ""}
            />
          )}
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
        <Select
          label="Destiné aux membres (plusieurs choix possibles)"
          multiple
          value={recipients}
          onChange={(e) => setRecipients(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {data.core.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </Select>
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
        folderId={file.folderId}
        submittedByMemberId={file.submittedByMemberId}
        recipientMemberIds={file.recipientMemberIds}
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
  const [category, setCategory] = useState("other"),
    [folder, setFolder] = useState(""),
    [submittedBy, setSubmittedBy] = useState("");
  const [review, setReview] = useState<FileRecord | null>(null);
  const files = latestFiles(data.files).filter(
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
      <div className="flow-form-grid">
        <Select
          label="Dossier de classement"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <FolderOptions data={data} />
        </Select>
        <Select
          label="Transmis par le membre (déclaré)"
          value={submittedBy}
          onChange={(e) => setSubmittedBy(e.target.value)}
        >
          <option value="">Non renseigné</option>
          {data.core.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </Select>
      </div>
      <Uploader
        entityType={entityType}
        entityId={entityId}
        category={category}
        folderId={folder}
        submittedByMemberId={submittedBy}
        recipientMemberIds={entityType === "member" ? [entityId] : []}
      />
      <DocumentDownload data={data} files={files} />
      {entityType === "event" && (
        <p className="flow-muted">
          Les dernières versions actives de ces documents sont jointes aux prochains envois de
          convocations et relances (12 pièces maximum).
        </p>
      )}
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
      <small>
        {datetime(file.createdAt)} · {file.uploadedBy || "Ajout antérieur"}
      </small>
    </article>
  );
}
export function DocumentsPage() {
  return <Workspace>{(data) => <Documents data={data} />}</Workspace>;
}
function Documents({ data }: { data: WorkspaceView }) {
  const [review, setReview] = useState<FileRecord | null>(null);
  const [category, setCategory] = useState("other"),
    [submittedBy, setSubmittedBy] = useState(""),
    [recipients, setRecipients] = useState<string[]>([]);
  return (
    <>
      <DocumentLibrary
        data={data}
        uploader={(folderId) => (
          <>
            <div className="flow-form-grid">
              <Select
                label="Type de document"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(categories).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                label="Transmis par le membre (déclaré)"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
              >
                <option value="">Non renseigné</option>
                {data.core.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </Select>
            </div>
            <Select
              label="Destiné aux membres (plusieurs choix possibles)"
              multiple
              value={recipients}
              onChange={(e) => setRecipients(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {data.core.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </Select>
            <Uploader
              entityType="club"
              entityId={data.core.clubs[0].id}
              category={category}
              folderId={folderId}
              submittedByMemberId={submittedBy}
              recipientMemberIds={recipients}
            />
          </>
        )}
        card={(file) => <FileCard file={file} onOpen={() => setReview(file)} />}
      />
      {review && <FileReview file={review} data={data} onClose={() => setReview(null)} />}
    </>
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
  const docs = latestFiles(memberFiles(data, memberId));
  const tasks = data.flow.workTasks.filter((t) => t.memberId === memberId);
  return (
    <Page
      title={`${member.first_name} ${member.last_name}`}
      back="/users"
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
          { label: "Licence", value: licenseStatus(data, memberId) },
          { label: "Photo", value: current?.photoId ? "Ajoutée" : "À ajouter" },
        ]}
      />
      <LicenseReminder memberId={memberId} />
      <MemberActivity data={data} memberId={memberId} docs={docs} />
      <Panel title="Tâches du membre">
        <p>
          {tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length} à accomplir ·{" "}
          {tasks.filter((t) => t.status === "done").length} terminées ·{" "}
          {tasks.filter((t) => t.status === "cancelled").length} annulées
        </p>
        <Link className="flow-button secondary" to={`/tasks?memberId=${memberId}`}>
          Ouvrir le tableau des tâches de ce membre
        </Link>
        <div className="flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Échéance</th>
                <th>État</th>
                <th>Checklist</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="flow-link" to={`/tasks?memberId=${memberId}&taskId=${t.id}`}>
                      {t.title}
                    </Link>
                  </td>
                  <td>{datetime(t.dueAt)}</td>
                  <td>
                    <Status value={t.status} />
                  </td>
                  <td>
                    {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!tasks.length && <Empty>Aucune tâche attribuée.</Empty>}
      </Panel>
      <Panel title="Convocations et documents des événements">
        <div className="flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Événement</th>
                <th>Date</th>
                <th>Disponibilité</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {data.core.invitations
                .filter((i) => i.member.id === memberId)
                .map((i) => {
                  const event = data.core.events.find((e) => e.id === i.event_id);
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link className="flow-link" to={`/events/${i.event_id}`}>
                          {event?.title || "Événement"}
                        </Link>
                      </td>
                      <td>{datetime(event?.starts_at)}</td>
                      <td>
                        {
                          (
                            {
                              pending: "En attente",
                              available: "Disponible",
                              unavailable: "Indisponible",
                            } as Record<string, string>
                          )[i.availability]
                        }
                      </td>
                      <td>
                        <Link className="flow-link" to={`/events/${i.event_id}?tab=documents`}>
                          Ouvrir les pièces
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
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

function MemberActivity({
  data,
  memberId,
  docs,
}: {
  data: WorkspaceView;
  memberId: string;
  docs: FileRecord[];
}) {
  const [view, setView] = useState("all"),
    [search, setSearch] = useState(""),
    [review, setReview] = useState<FileRecord | null>(null);
  const files = docs.filter(
    (f) =>
      (view === "all" ||
        (view === "submitted"
          ? f.submittedByMemberId === memberId
          : f.submittedByMemberId !== memberId)) &&
      f.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <Panel title="Tous les documents du membre">
      <div className="flow-toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <Select
          label="Origine des documents"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="all">Tous les documents liés</option>
          <option value="submitted">Transmis par ce membre</option>
          <option value="received">Reçus ou rattachés au membre</option>
        </Select>
      </div>
      <p className="flow-muted">
        Inclut les fichiers du dossier, des tâches, des convocations, des discussions et des envois
        destinés à ce membre. Le déposant déclaré indique l’origine fournie au gestionnaire.
      </p>
      <DocumentDownload data={data} files={files} name="foot-easy-dossier-membre" />
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Dossier / rattachement</th>
              <th>Origine</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>
                  {f.name}
                  <small>
                    v{f.version} · {datetime(f.createdAt)}
                  </small>
                </td>
                <td>
                  {folderPath(data.flow.folders || [], f.folderId)
                    .map((p) => p.name)
                    .join(" / ") || "Racine"}
                  <small>
                    {f.entityType === "event"
                      ? data.core.events.find((e) => e.id === f.entityId)?.title
                      : f.entityType === "task"
                        ? data.flow.workTasks.find((t) => t.id === f.entityId)?.title
                        : f.entityType}
                  </small>
                </td>
                <td>
                  {f.submittedByMemberId
                    ? `Transmis par ${person(data, f.submittedByMemberId)}`
                    : "Reçu ou rattaché"}
                  <small>Ajouté par {f.uploadedBy || "Historique antérieur"}</small>
                </td>
                <td>
                  <Status value={f.status} />
                </td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => setReview(f)}>
                    Voir / classer
                  </Button>
                  <a className="flow-link" href={`${f.url}?download=1`}>
                    Télécharger
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!files.length && <Empty>Aucun document dans cette sélection.</Empty>}
      {review && <FileReview file={review} data={data} onClose={() => setReview(null)} />}
    </Panel>
  );
}
