import { CheckCircle2, Circle, Send } from "lucide-react";
import { Link } from "react-router-dom";
import type { Event } from "@/api/client";
import { useWorkspace } from "./client";
import { Status } from "./ui";

export function EventWorkflow({
  event,
  onTabChange,
}: {
  event: Event;
  onTabChange: (tab: string) => void;
}) {
  const { data } = useWorkspace();
  if (!data) return null;
  const invitations = data.core.invitations.filter((i) => i.event_id === event.id);
  const pending = invitations.filter((i) => i.availability === "pending").length;
  const lineup = data.core.lineups.find((l) => l.event_id === event.id);
  const tasks = data.flow.workTasks.filter(
    (t) => t.eventId === event.id && t.status !== "cancelled",
  );
  const campaigns = data.flow.campaigns.filter((c) => c.eventId === event.id);
  const deliveries = data.flow.deliveries.filter((d) =>
    campaigns.some((c) => c.id === d.campaignId),
  );
  const failures = deliveries.filter((d) => ["failed", "bounced"].includes(d.status)).length;
  const competitive = ["match", "tournament"].includes(event.kind);
  const steps = [
    {
      title: "Convocations",
      tab: "invitations",
      done: invitations.length > 0 && pending === 0,
      detail: invitations.length
        ? `${invitations.length - pending}/${invitations.length} réponses`
        : "Effectif à convoquer",
    },
    ...(competitive
      ? [
          {
            title: "Composition",
            tab: "lineup",
            done: Boolean(lineup?.is_published),
            detail: lineup?.is_published
              ? "Publiée"
              : lineup
                ? "Brouillon enregistré"
                : "À préparer",
          },
        ]
      : []),
    ...(competitive
      ? [
          {
            title: "Résultat",
            tab: "match",
            done: event.score_for !== null && event.score_against !== null,
            detail:
              event.score_for !== null && event.score_against !== null
                ? `${event.score_for} – ${event.score_against}`
                : "À renseigner après le match",
          },
        ]
      : []),
    {
      title: "Documents",
      tab: "documents",
      done: data.files.some(
        (f) => f.entityType === "event" && f.entityId === event.id && f.status === "approved",
      ),
      detail: `${data.files.filter((f) => f.entityType === "event" && f.entityId === event.id && f.status !== "archived").length} fichiers`,
    },
    {
      title: "Responsabilités",
      tab: "tasks",
      done: tasks.length > 0 && tasks.every((t) => t.status === "done"),
      detail: tasks.length
        ? `${tasks.filter((t) => t.status === "done").length}/${tasks.length} terminées`
        : "À attribuer si nécessaire",
    },
  ];
  return (
    <section className="event-workflow" aria-label="Suivi de cet événement">
      <div className="event-workflow-heading">
        <strong>Suivi de cet événement</strong>
        {event.is_cancelled && <Status value="cancelled" />}
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step.tab}>
            <button
              type="button"
              disabled={event.is_cancelled && step.tab === "lineup"}
              onClick={() => onTabChange(step.tab)}
            >
              {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="event-workflow-distribution">
        <span>
          <Send size={16} />
          {campaigns.length} envois simulés · {deliveries.length} suivis destinataires
          {failures > 0 && ` · ${failures} échecs à traiter`}
        </span>
        <Link
          className="flow-link"
          to={campaigns.length ? `/campaigns/${campaigns[0].id}` : `/campaigns?eventId=${event.id}`}
        >
          Ouvrir le suivi des envois
        </Link>
      </div>
    </section>
  );
}
