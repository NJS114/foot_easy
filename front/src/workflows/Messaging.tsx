import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, MessageCircle, Pin, Plus, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { WorkspaceView } from "./types";
import { useAction, datetime } from "./client";
import {
  Workspace,
  Page,
  Field,
  Select,
  Textarea,
  Checkbox,
  Feedback,
  FormActions,
  Empty,
  SearchBox,
  ConfirmButton,
  person,
} from "./ui";
import { AttachmentPicker, Attachments, DocumentPanel } from "./Documents";

export function MessagingPage() {
  return <Workspace>{(data) => <Messaging data={data} />}</Workspace>;
}
function Messaging({ data }: { data: WorkspaceView }) {
  const [params] = useSearchParams();
  const eventId = params.get("eventId") || "";
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [showArchived, setArchived] = useState(false),
    [create, setCreate] = useState(false),
    [body, setBody] = useState(""),
    [attachmentIds, setAttachments] = useState<string[]>([]),
    [docs, setDocs] = useState(false);
  const action = useAction();
  const conversations = data.flow.conversations
    .filter(
      (c) =>
        c.archived === showArchived &&
        (!eventId || c.eventId === eventId) &&
        `${c.title} ${c.messages.map((m) => m.body).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const current = conversations.find((c) => c.id === selected) || conversations[0];
  async function reply() {
    if (!current) return;
    try {
      await action.mutateAsync({
        type: "conversation.reply",
        payload: { id: current.id, body, attachmentIds },
      });
      setBody("");
      setAttachments([]);
    } catch {
      /* Preserve text and attachments. */
    }
  }
  return (
    <Page
      title="Messagerie du club"
      description="Conversations, annonces et pièces jointes dans votre espace privé."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/campaigns">Campagnes & envois</Link>
          </Button>
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Nouvelle conversation
          </Button>
        </>
      }
    >
      <div className="messaging-layout">
        <aside className="conversation-sidebar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Rechercher une conversation"
          />
          <div className="flow-segments">
            <button className={!showArchived ? "active" : ""} onClick={() => setArchived(false)}>
              Actives
            </button>
            <button className={showArchived ? "active" : ""} onClick={() => setArchived(true)}>
              Archivées
            </button>
          </div>
          {conversations.length ? (
            conversations.map((c) => (
              <button
                className={`conversation-item ${current?.id === c.id ? "selected" : ""}`}
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setBody("");
                  setAttachments([]);
                  setDocs(false);
                }}
              >
                <span className="conversation-icon">
                  <MessageCircle size={20} />
                </span>
                <span>
                  <strong>
                    {c.title}
                    {c.pinned && <Pin size={13} />}
                  </strong>
                  <small>{c.messages.at(-1)?.body || "Commencez la discussion"}</small>
                  <small>
                    {c.memberIds.length} destinataires ·{" "}
                    {c.kind === "announcement"
                      ? "Annonce"
                      : c.kind === "direct"
                        ? "Direct"
                        : "Groupe"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <Empty>Aucune conversation dans cette vue.</Empty>
          )}
        </aside>
        <section className="conversation-main">
          {current ? (
            <>
              <header className="conversation-header">
                <div>
                  <h2>{current.title}</h2>
                  <small>
                    {current.memberIds.length} destinataires sélectionnés · Espace privé de
                    démonstration
                  </small>
                </div>
                <div className="flow-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={current.pinned ? "Détacher" : "Épingler"}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        type: "conversation.toggle",
                        payload: { id: current.id, field: "pinned" },
                      })
                    }
                  >
                    <Pin />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDocs(!docs)}>
                    {docs ? "Messages" : "Fichiers"}
                  </Button>
                  <ConfirmButton
                    label={<Archive size={16} />}
                    title={
                      current.archived ? "Rouvrir la conversation ?" : "Archiver la conversation ?"
                    }
                    onConfirm={() =>
                      action.mutateAsync({
                        type: "conversation.toggle",
                        payload: { id: current.id, field: "archived" },
                      })
                    }
                    pending={action.isPending}
                  >
                    L’historique et les pièces jointes seront conservés.
                  </ConfirmButton>
                </div>
              </header>
              {docs ? (
                <div className="conversation-docs">
                  <DocumentPanel data={data} entityType="conversation" entityId={current.id} />
                  <h3 className="flow-section-title">Fichiers échangés dans les messages</h3>
                  <Attachments
                    ids={[...new Set(current.messages.flatMap((m) => m.attachmentIds))]}
                    data={data}
                  />
                  <details>
                    <summary>Destinataires sélectionnés</summary>
                    <div className="recipient-tags">
                      {current.memberIds.map((id) => (
                        <span key={id}>{person(data, id)}</span>
                      ))}
                    </div>
                  </details>
                </div>
              ) : (
                <>
                  <div className="message-thread">
                    {current.messages.length ? (
                      current.messages.map((m) => (
                        <article
                          className={`chat-message ${m.author === data.user.name ? "own" : ""}`}
                          key={m.id}
                        >
                          <div className="chat-message-meta">
                            <strong>{m.author}</strong>
                            <time>{datetime(m.createdAt)}</time>
                          </div>
                          <div className="chat-bubble">
                            <p>{m.body}</p>
                            <Attachments ids={m.attachmentIds} data={data} />
                          </div>
                          <button
                            className={`message-reaction ${m.reactions.includes(data.user.name) ? "selected" : ""}`}
                            type="button"
                            onClick={() =>
                              action.mutate({
                                type: "message.react",
                                payload: { id: current.id, messageId: m.id },
                              })
                            }
                          >
                            <ThumbsUp size={13} />
                            {m.reactions.length || "J’aime"}
                          </button>
                        </article>
                      ))
                    ) : (
                      <Empty>Ajoutez le premier message à cette conversation.</Empty>
                    )}
                  </div>
                  {!current.archived && (
                    <form
                      className="message-composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void reply();
                      }}
                    >
                      <Textarea
                        label="Votre message"
                        rows={3}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Écrivez à votre équipe…"
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            void reply();
                          }
                        }}
                      />
                      <AttachmentPicker
                        data={data}
                        selected={attachmentIds}
                        onChange={setAttachments}
                      />
                      <div className="flow-row">
                        <small>Ctrl + Entrée pour publier dans cette conversation.</small>
                        <Button
                          disabled={action.isPending || (!body.trim() && !attachmentIds.length)}
                        >
                          <Send />
                          Publier le message
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
              <Feedback error={action.error} />
            </>
          ) : (
            <Empty action={<Button onClick={() => setCreate(true)}>Créer une conversation</Button>}>
              Choisissez une conversation ou créez un groupe.
            </Empty>
          )}
        </section>
      </div>
      {create && (
        <ConversationEditor
          data={data}
          eventId={eventId}
          onClose={() => setCreate(false)}
          onCreated={(id) => {
            setSelected(id);
            setArchived(false);
          }}
        />
      )}
    </Page>
  );
}
function ConversationEditor({
  data,
  eventId,
  onClose,
  onCreated,
}: {
  data: WorkspaceView;
  eventId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const action = useAction();
  const [title, setTitle] = useState(""),
    [kind, setKind] = useState("team"),
    [teamId, setTeam] = useState(""),
    [ids, setIds] = useState<string[]>([]);
  const members = data.core.members.filter((m) => !teamId || m.team_id === teamId);
  return (
    <Modal title="Nouvelle conversation" onClose={onClose}>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const result = await action.mutateAsync({
              type: "conversation.save",
              payload: { title, kind, teamId, eventId, memberIds: ids },
            });
            onCreated(result.entityId);
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <Field
          label="Titre"
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="team">Groupe de discussion</option>
          <option value="direct">Conversation directe</option>
          <option value="announcement">Annonce du club</option>
        </Select>
        <Select
          label="Équipe"
          value={teamId}
          onChange={(e) => {
            setTeam(e.target.value);
            setIds([]);
          }}
        >
          <option value="">Toutes les équipes</option>
          {data.core.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <div className="flow-row">
          <strong>{ids.length} destinataires</strong>
          {kind !== "direct" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIds(members.map((m) => m.id))}
            >
              Sélectionner l’équipe
            </Button>
          )}
        </div>
        <div className="recipient-picker">
          {members.map((m) => (
            <Checkbox
              key={m.id}
              label={`${m.first_name} ${m.last_name}`}
              checked={ids.includes(m.id)}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? kind === "direct"
                      ? [m.id]
                      : [...ids, m.id]
                    : ids.filter((x) => x !== m.id),
                )
              }
            />
          ))}
        </div>
        <Feedback error={action.error} />
        <FormActions pending={action.isPending} onClose={onClose} label="Créer la conversation" />
      </form>
    </Modal>
  );
}
