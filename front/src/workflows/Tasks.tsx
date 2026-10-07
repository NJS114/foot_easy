import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, CalendarClock, CheckSquare, Paperclip, MessageCircle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { WorkspaceView, WorkTask } from "./types";
import { useAction, localInput, datetime } from "./client";
import {
  Workspace,
  Page,
  Panel,
  Metrics,
  Field,
  Select,
  Textarea,
  Checkbox,
  Feedback,
  FormActions,
  SearchBox,
  Status,
  AuditTrail,
  person,
  ConfirmButton,
} from "./ui";
import { AttachmentPicker, Attachments, DocumentPanel } from "./Documents";

export function TasksPage() {
  return (
    <Workspace>
      {(data) => (
        <Page
          title="Tâches & responsabilités"
          description="Attribuer, suivre, justifier et valider le travail de chaque équipe."
        >
          <TaskBoard data={data} />
        </Page>
      )}
    </Workspace>
  );
}
export function EventTasksPanel({ eventId }: { eventId: string }) {
  return <Workspace>{(data) => <TaskBoard data={data} eventId={eventId} />}</Workspace>;
}
export function TaskBoard({ data, eventId }: { data: WorkspaceView; eventId?: string }) {
  const [params] = useSearchParams();
  const [member, setMember] = useState(params.get("memberId") || "");
  const [team, setTeam] = useState(""),
    [search, setSearch] = useState(""),
    [late, setLate] = useState(false),
    [selected, setSelected] = useState<string | null>(params.get("taskId")),
    [edit, setEdit] = useState<WorkTask | null | undefined>(undefined),
    [archived, setArchived] = useState(false);
  const tasks = data.flow.workTasks.filter(
    (t) =>
      (!eventId || t.eventId === eventId) &&
      (!member || t.memberId === member) &&
      (!team || t.teamId === team) &&
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (!late ||
        (!["done", "cancelled"].includes(t.status) && t.dueAt < new Date().toISOString())) &&
      (archived || t.status !== "cancelled"),
  );
  const selectedTask = data.flow.workTasks.find((t) => t.id === selected);
  const columns = [
    { key: "todo", title: "À faire", accept: ["todo"] },
    { key: "in_progress", title: "En cours", accept: ["in_progress", "blocked"] },
    { key: "submitted", title: "À valider", accept: ["submitted"] },
    { key: "done", title: "Terminées", accept: ["done", ...(archived ? ["cancelled"] : [])] },
  ];
  return (
    <>
      <Metrics
        items={[
          { label: "Tâches", value: tasks.length },
          {
            label: "En cours",
            value: tasks.filter((t) => ["in_progress", "blocked"].includes(t.status)).length,
          },
          { label: "À valider", value: tasks.filter((t) => t.status === "submitted").length },
          { label: "Terminées", value: tasks.filter((t) => t.status === "done").length },
        ]}
      />
      <div className="flow-toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher une tâche" />
        {!eventId && (
          <Select label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Toutes</option>
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Membre responsable"
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="">Tous les membres</option>
          {data.core.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </Select>
        <Checkbox label="En retard" checked={late} onChange={(e) => setLate(e.target.checked)} />
        <Checkbox
          label="Inclure les annulées"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        <Button onClick={() => setEdit(null)}>
          <Plus />
          Nouvelle tâche
        </Button>
      </div>
      <div className="task-board">
        {columns.map((column) => (
          <section className={`task-column column-${column.key}`} key={column.key}>
            <h2>
              {column.title}
              <span>{tasks.filter((t) => column.accept.includes(t.status)).length}</span>
            </h2>
            {tasks
              .filter((t) => column.accept.includes(t.status))
              .map((t) => (
                <button className="task-card" key={t.id} onClick={() => setSelected(t.id)}>
                  <div className="flow-row">
                    <span className={`priority priority-${t.priority}`}>
                      <Flag size={12} />
                      {t.priority === "high"
                        ? "Prioritaire"
                        : t.priority === "low"
                          ? "Basse priorité"
                          : "Normale"}
                    </span>
                    {t.status === "blocked" && <Status value="blocked" />}
                  </div>
                  <h3>{t.title}</h3>
                  <p>{data.core.teams.find((x) => x.id === t.teamId)?.name}</p>
                  <span className="task-owner">
                    <span className="member-avatar">
                      {t.memberId
                        ? person(data, t.memberId)
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")
                        : "?"}
                    </span>
                    {t.memberId ? person(data, t.memberId) : "À attribuer"}
                  </span>
                  <span
                    className={
                      t.dueAt < new Date().toISOString() &&
                      !["done", "cancelled"].includes(t.status)
                        ? "task-due late"
                        : "task-due"
                    }
                  >
                    <CalendarClock size={14} />
                    {datetime(t.dueAt)}
                  </span>
                  <div className="task-card-meta">
                    <span>
                      <CheckSquare size={14} />
                      {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
                    </span>
                    {t.requireProof && (
                      <span>
                        <Paperclip size={14} />
                        Justificatif
                      </span>
                    )}
                    {t.comments.length > 0 && (
                      <span>
                        <MessageCircle size={14} />
                        {t.comments.length}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            {!tasks.some((t) => column.accept.includes(t.status)) && (
              <p className="flow-muted">Aucune tâche</p>
            )}
          </section>
        ))}
      </div>
      {selectedTask && (
        <TaskDetail
          data={data}
          task={selectedTask}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEdit(selectedTask);
            setSelected(null);
          }}
        />
      )}
      {edit !== undefined && (
        <TaskEditor
          data={data}
          task={edit || undefined}
          eventId={eventId}
          memberId={member}
          onClose={() => setEdit(undefined)}
          onSaved={(id) => setSelected(id)}
        />
      )}
    </>
  );
}
function TaskEditor({
  data,
  task,
  eventId,
  memberId,
  onClose,
  onSaved,
}: {
  data: WorkspaceView;
  task?: WorkTask;
  eventId?: string;
  memberId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const action = useAction();
  const selectedEvent = data.core.events.find((e) => e.id === (eventId || task?.eventId));
  const [team, setTeam] = useState(
      task?.teamId ||
        selectedEvent?.team_id ||
        data.core.members.find((m) => m.id === memberId)?.team_id ||
        data.core.teams[0].id,
    ),
    [event, setEvent] = useState(task?.eventId || eventId || ""),
    [files, setFiles] = useState(task?.attachmentIds || []);
  return (
    <Modal title={task ? "Modifier la tâche" : "Nouvelle tâche"} onClose={onClose} wide>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const result = await action.mutateAsync({
              type: "task.save",
              payload: {
                id: task?.id,
                title: f.get("title"),
                description: f.get("description"),
                teamId: team,
                eventId: event,
                memberId: f.get("memberId"),
                priority: f.get("priority"),
                dueAt: new Date(String(f.get("dueAt"))).toISOString(),
                checklist: String(f.get("checklist"))
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
                attachmentIds: files,
                requireProof: f.get("requireProof") === "on",
              },
            });
            onClose();
            onSaved(result.entityId);
          } catch {
            /* preserve */
          }
        }}
      >
        <Field label="Intitulé de la tâche" required name="title" defaultValue={task?.title} />
        <div className="flow-form-grid">
          <Select
            label="Équipe"
            value={team}
            disabled={!!eventId}
            onChange={(e) => {
              setTeam(e.target.value);
              setEvent("");
            }}
          >
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select
            label="Événement associé"
            value={event}
            disabled={!!eventId}
            onChange={(e) => setEvent(e.target.value)}
          >
            <option value="">Tâche du club, sans événement</option>
            {data.core.events
              .filter((e) => e.team_id === team)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {datetime(e.starts_at)}
                </option>
              ))}
          </Select>
          <Select
            label="Responsable"
            name="memberId"
            defaultValue={task?.memberId || memberId || ""}
          >
            <option value="">À attribuer</option>
            {data.core.members
              .filter((m) => m.team_id === team)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
          </Select>
          <Select label="Priorité" name="priority" defaultValue={task?.priority || "normal"}>
            <option value="low">Basse</option>
            <option value="normal">Normale</option>
            <option value="high">Haute</option>
          </Select>
          <Field
            label="Échéance"
            type="datetime-local"
            required
            name="dueAt"
            defaultValue={localInput(
              task?.dueAt ||
                selectedEvent?.starts_at ||
                new Date(Date.now() + 86400000).toISOString(),
            )}
          />
        </div>
        <Textarea label="Instructions" name="description" defaultValue={task?.description} />
        <Textarea
          label="Checklist : une étape par ligne"
          name="checklist"
          rows={4}
          defaultValue={task?.checklist.map((c) => c.text).join("\n")}
        />
        <Checkbox
          label="Demander un fichier ou une photo comme justificatif avant validation"
          name="requireProof"
          defaultChecked={task?.requireProof}
        />
        <AttachmentPicker
          data={data}
          selected={files}
          onChange={setFiles}
          label="Documents d’instructions"
        />
        <Feedback error={action.error} />
        <FormActions pending={action.isPending} onClose={onClose} />
      </form>
    </Modal>
  );
}
function TaskDetail({
  data,
  task,
  onClose,
  onEdit,
}: {
  data: WorkspaceView;
  task: WorkTask;
  onClose: () => void;
  onEdit: () => void;
}) {
  const action = useAction();
  const [comment, setComment] = useState(""),
    [files, setFiles] = useState<string[]>([]),
    [reasonFor, setReasonFor] = useState<"blocked" | "in_progress" | null>(null),
    [reason, setReason] = useState("");
  const transition = (status: string, reason = "") =>
    action.mutateAsync({ type: "task.transition", payload: { id: task.id, status, reason } });
  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="flow-row">
        <Status value={task.status} />
        <Button
          variant="outline"
          disabled={["done", "cancelled"].includes(task.status)}
          onClick={onEdit}
        >
          Modifier
        </Button>
      </div>
      <div className="task-detail-summary">
        <span>
          Responsable :{" "}
          <strong>{task.memberId ? person(data, task.memberId) : "À attribuer"}</strong>
        </span>
        <span>
          Échéance : <strong>{datetime(task.dueAt)}</strong>
        </span>
        {task.eventId && (
          <Link to={`/events/${task.eventId}`} onClick={onClose} className="flow-link">
            Ouvrir l’événement associé
          </Link>
        )}
      </div>
      <p className="flow-message-text">{task.description}</p>
      <Attachments ids={task.attachmentIds} data={data} />
      <div className="task-checklist">
        {task.checklist.map((item) => (
          <Checkbox
            key={item.id}
            label={item.text}
            checked={item.done}
            disabled={action.isPending || ["done", "cancelled", "submitted"].includes(task.status)}
            onChange={(e) =>
              action.mutate({
                type: "task.check",
                payload: { id: task.id, itemId: item.id, done: e.target.checked },
              })
            }
          />
        ))}
      </div>
      <div className="flow-actions task-transitions">
        {task.status === "todo" && (
          <Button onClick={() => void transition("in_progress").catch(() => {})}>Commencer</Button>
        )}
        {task.status === "in_progress" && (
          <>
            <Button onClick={() => void transition("submitted").catch(() => {})}>
              Soumettre pour validation
            </Button>
            <Button variant="outline" onClick={() => setReasonFor("blocked")}>
              Signaler un blocage
            </Button>
          </>
        )}
        {task.status === "blocked" && (
          <Button onClick={() => void transition("in_progress").catch(() => {})}>Reprendre</Button>
        )}
        {task.status === "submitted" && (
          <>
            <Button onClick={() => void transition("done").catch(() => {})}>
              Valider la réalisation
            </Button>
            <Button variant="outline" onClick={() => setReasonFor("in_progress")}>
              Demander une correction
            </Button>
          </>
        )}
        {["done", "cancelled"].includes(task.status) && (
          <Button variant="outline" onClick={() => void transition("todo").catch(() => {})}>
            Rouvrir la tâche
          </Button>
        )}
        {["todo", "in_progress", "blocked"].includes(task.status) && (
          <ConfirmButton
            label="Annuler la tâche"
            title="Annuler cette tâche ?"
            pending={action.isPending}
            onConfirm={() => transition("cancelled")}
          >
            Les commentaires, étapes et justificatifs seront conservés.
          </ConfirmButton>
        )}
      </div>
      <Feedback error={action.error} success={action.data?.message} />
      {reasonFor && (
        <form
          className="flow-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await transition(reasonFor, reason);
              setReasonFor(null);
              setReason("");
            } catch {
              /* preserve */
            }
          }}
        >
          <Textarea
            label={reasonFor === "blocked" ? "Motif du blocage" : "Correction demandée"}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button disabled={action.isPending}>Enregistrer le motif</Button>
        </form>
      )}
      <DocumentPanel
        data={data}
        entityType="task"
        entityId={task.id}
        title={
          task.requireProof
            ? "Justificatif obligatoire : photo ou document"
            : "Photos et justificatifs"
        }
      />
      <Panel title="Échanges autour de la tâche">
        {task.comments.map((c) => (
          <article key={c.id} className="task-comment">
            <strong>{c.author}</strong>
            <small>{datetime(c.createdAt)}</small>
            <p>{c.body}</p>
            <Attachments ids={c.attachmentIds} data={data} />
          </article>
        ))}
        <form
          className="flow-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await action.mutateAsync({
                type: "task.comment",
                payload: { id: task.id, body: comment, attachmentIds: files },
              });
              setComment("");
              setFiles([]);
            } catch {
              /* preserve */
            }
          }}
        >
          <Textarea
            label="Ajouter un commentaire"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <AttachmentPicker data={data} selected={files} onChange={setFiles} />
          <Button disabled={action.isPending || (!comment.trim() && !files.length)}>
            Publier le commentaire
          </Button>
        </form>
      </Panel>
      <details className="flow-details">
        <summary>Historique des étapes</summary>
        <AuditTrail data={data} entityId={task.id} />
      </details>
    </Modal>
  );
}
