import {
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { CheckCircle2, ChevronLeft, Search, Inbox, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { useWorkspace, datetime } from "./client";
import type { WorkspaceView } from "./types";

export const labels: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Programmé",
  running: "En cours",
  paused: "En pause",
  completed: "Terminé",
  cancelled: "Annulé",
  queued: "En file",
  sending: "Envoi en cours",
  delivered: "Distribué",
  opened: "Lu",
  clicked: "Cliqué",
  failed: "Échec",
  bounced: "Rejeté",
  unsubscribed: "Désinscrit",
  excluded: "Exclu",
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
  archived: "Archivé",
  active: "Actif",
  ended: "Terminé",
  prospect: "Prospect",
  contacted: "Contacté",
  proposal: "Proposition",
  negotiation: "Négociation",
  signed: "Signé",
  declined: "Décliné",
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  open: "Ouverte",
  closed: "Clôturée",
  paid: "Réglé",
  partial: "Partiel",
  unpaid: "À régler",
  overdue: "En retard",
  exempt: "Exonéré",
  refunded: "Remboursé",
  succeeded: "Confirmé",
  todo: "À faire",
  in_progress: "En cours",
  blocked: "Bloqué",
  submitted: "À valider",
  done: "Terminé",
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  finished: "Terminé",
  played: "Joué",
  postponed: "Reporté",
  information: "Information",
  invitation: "Convocation",
  reminder: "Relance",
  advertising: "Publicité",
  email: "Email",
  sms: "SMS",
  push: "Notification",
  inapp: "Espace club",
  membership: "Cotisation",
  equipment: "Équipement",
  tournament: "Tournoi",
  donation: "Don",
  card: "Carte · simulation",
  cash: "Espèces",
  transfer: "Virement",
  cheque: "Chèque",
};
export function Status({ value }: { value: string }) {
  return <span className={`flow-status status-${value}`}>{labels[value] || value}</span>;
}
export function Page({
  title,
  description,
  actions,
  children,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  back?: string;
}) {
  return (
    <div className="flow-page">
      {back && (
        <Link className="flow-back" to={back}>
          <ChevronLeft size={16} />
          Retour
        </Link>
      )}
      <header className="page-heading">
        <div>
          <h1>{title}</h1>
          {description && <p className="page-subtitle">{description}</p>}
        </div>
        <div className="flow-actions">{actions}</div>
      </header>
      {children}
    </div>
  );
}
export function Workspace({ children }: { children: (data: WorkspaceView) => ReactNode }) {
  const query = useWorkspace();
  if (query.isLoading)
    return (
      <div className="flow-loading">
        <LoaderCircle className="animate-spin" />
        Chargement de votre club…
      </div>
    );
  if (query.error || !query.data)
    return (
      <div className="flow-error" role="alert">
        <strong>Votre espace n’est pas disponible.</strong>
        <p>{query.error?.message}</p>
        <Button onClick={() => query.refetch()}>Réessayer</Button>
      </div>
    );
  return <>{children(query.data)}</>;
}
export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flow-panel ${className}`}>
      {(title || actions) && (
        <header>
          <h2>{title}</h2>
          <div className="flow-actions">{actions}</div>
        </header>
      )}
      <div className="flow-panel-body">{children}</div>
    </section>
  );
}
export function Metrics({
  items,
}: {
  items: { label: string; value: ReactNode; detail?: string }[];
}) {
  return (
    <div className="flow-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
        </div>
      ))}
    </div>
  );
}
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flow-empty">
      <Inbox size={30} />
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flow-field">
      <span>
        {label}
        {props.required && " *"}
      </span>
      <Input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="flow-field">
      <span>
        {label}
        {props.required && " *"}
      </span>
      <NativeSelect {...props}>{children}</NativeSelect>
    </label>
  );
}
export function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flow-field">
      <span>
        {label}
        {props.required && " *"}
      </span>
      <textarea className="flow-textarea" {...props} />
    </label>
  );
}
export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flow-checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Rechercher…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flow-search">
      <Search size={17} />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Feedback({ error, success }: { error?: Error | null; success?: string }) {
  return (
    <>
      {error && (
        <p className="flow-error" role="alert">
          {error.message}
        </p>
      )}
      {success && !error && (
        <p className="flow-success" role="status">
          <CheckCircle2 size={16} />
          {success}
        </p>
      )}
    </>
  );
}
export function FormActions({
  pending,
  onClose,
  label = "Enregistrer",
}: {
  pending: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="flow-form-actions">
      <Button type="button" variant="outline" onClick={onClose}>
        Fermer
      </Button>
      <Button disabled={pending} type="submit">
        {pending ? "Enregistrement…" : label}
      </Button>
    </div>
  );
}
export function ConfirmButton({
  label,
  title,
  children,
  onConfirm,
  pending = false,
  variant = "outline",
}: {
  label: ReactNode;
  title: string;
  children: ReactNode;
  onConfirm: () => Promise<unknown> | unknown;
  pending?: boolean;
  variant?: "outline" | "destructive" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  return (
    <>
      <Button variant={variant} type="button" disabled={pending} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <p className="mb-5">{children}</p>
          <Feedback error={error} />
          <div className="flow-form-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Retour
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (e) {
                  setError(e as Error);
                }
              }}
            >
              Confirmer
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function AuditTrail({ data, entityId }: { data: WorkspaceView; entityId?: string }) {
  const rows = data.flow.audit.filter((a) => !entityId || a.entityId === entityId).slice(0, 100);
  return rows.length ? (
    <ol className="flow-timeline">
      {rows.map((a) => (
        <li key={a.id}>
          <span className="timeline-dot" />
          <div>
            <strong>{a.detail || a.action}</strong>
            <small>
              {datetime(a.at)} · {a.actor}
            </small>
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <Empty>L’historique apparaîtra après la première action.</Empty>
  );
}
export function formValues(form: HTMLFormElement): Record<string, unknown> {
  return Object.fromEntries(new FormData(form).entries());
}
export function person(data: WorkspaceView, id: string) {
  const member = data.core.members.find((m) => m.id === id);
  return member ? `${member.first_name} ${member.last_name}` : "Membre supprimé";
}
