import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Mail, ShieldCheck, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Page,
  Panel,
  Workspace,
  Metrics,
  Select,
  Status,
  AuditTrail,
  Feedback,
  Empty,
  SearchBox,
} from "./ui";
import { useAction, datetime, downloadCSV } from "./client";
import { chargeStatus, paidAmount } from "./domain";
import type { WorkspaceView } from "./types";
export function SettingsPage() {
  return <Workspace>{(data) => <Settings data={data} />}</Workspace>;
}
function Settings({ data }: { data: WorkspaceView }) {
  const action = useAction();
  return (
    <Page
      title="Réglages & activité"
      description="Votre espace enregistré, les scénarios de test et la traçabilité du club."
    >
      <div className="flow-two-columns">
        <Panel title="Fournisseurs de communication">
          <div className="flow-info">
            <FlaskConical size={24} />
            <p>
              Les emails, SMS, notifications et cartes bancaires sont simulés. Aucun compte Twilio,
              service d’email ou prestataire bancaire n’est connecté.
            </p>
          </div>
          <Select
            label="Scénario des prochains envois"
            value={data.flow.settings.deliveryMode}
            onChange={(e) =>
              action.mutate({ type: "settings.save", payload: { deliveryMode: e.target.value } })
            }
          >
            <option value="realistic">Réaliste : succès, échecs et rejets</option>
            <option value="success">Tous les contacts valides réussissent</option>
            <option value="failure">Échec technique pour tester les relances</option>
          </Select>
          <p className="flow-muted">
            Le suivi progresse quand l’espace est consulté. Les campagnes programmées sont
            déclenchées à la prochaine consultation après l’heure prévue. Un ordonnanceur et de
            vrais fournisseurs seront nécessaires pour des envois autonomes.
          </p>
          <Feedback error={action.error} success={action.data?.message} />
        </Panel>
        <Panel title="Sauvegarde & accès">
          <div className="flow-info">
            <ShieldCheck size={24} />
            <p>
              Vos modifications et fichiers sont enregistrés côté serveur dans cet espace privé. Les
              destinataires renseignés ici ne reçoivent pas automatiquement un accès à
              l’application.
            </p>
          </div>
          <dl className="flow-definitions">
            <dt>Connecté comme</dt>
            <dd>{data.user.name}</dd>
            <dt>Dernière lecture</dt>
            <dd>{datetime(data.serverTime)}</dd>
            <dt>Fichiers enregistrés</dt>
            <dd>{data.files.length}</dd>
            <dt>Version des données</dt>
            <dd>{data.revision}</dd>
          </dl>
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    {
                      exportedAt: new Date().toISOString(),
                      core: data.core,
                      flow: data.flow,
                      files: data.files,
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "foot-easy-sauvegarde.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download />
            Exporter les données
          </Button>
          <p className="flow-muted">
            L’export inclut les métadonnées des documents. Téléchargez les fichiers eux-mêmes depuis
            Documents.
          </p>
        </Panel>
      </div>
      <Panel title="Journal d’activité">
        <AuditTrail data={data} />
      </Panel>
    </Page>
  );
}
export function InvitationsPage() {
  return <Workspace>{(data) => <Invitations data={data} />}</Workspace>;
}
function Invitations({ data }: { data: WorkspaceView }) {
  const [team, setTeam] = useState(""),
    [search, setSearch] = useState(""),
    [period, setPeriod] = useState("upcoming");
  const today = new Date().toISOString();
  const events = data.core.events
    .filter(
      (e) =>
        (!team || e.team_id === team) &&
        e.title.toLowerCase().includes(search.toLowerCase()) &&
        (period === "all" || (period === "upcoming" ? e.starts_at >= today : e.starts_at < today)),
    )
    .sort((a, b) =>
      period === "past"
        ? b.starts_at.localeCompare(a.starts_at)
        : a.starts_at.localeCompare(b.starts_at),
    );
  const invitations = data.core.invitations.filter((i) => events.some((e) => e.id === i.event_id));
  return (
    <Page
      title="Convocations"
      description="Disponibilités, réponses et distribution des messages, événement par événement."
      actions={
        <Link className="flow-button" to="/campaigns">
          <Mail size={17} />
          Centre des envois
        </Link>
      }
    >
      <Metrics
        items={[
          { label: "Événements", value: events.length },
          { label: "Convocations", value: invitations.length },
          {
            label: "Disponibles",
            value: invitations.filter((i) => i.availability === "available").length,
          },
          {
            label: "Réponses attendues",
            value: invitations.filter((i) => i.availability === "pending").length,
          },
        ]}
      />
      <Panel title="Suivi du collectif">
        <div className="flow-toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <Select label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Toutes les équipes</option>
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Période" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="upcoming">À venir</option>
            <option value="past">Passés</option>
            <option value="all">Tous</option>
          </Select>
        </div>
        {events.length ? (
          <div className="flow-table-wrap">
            <table className="flow-table">
              <thead>
                <tr>
                  <th>Événement</th>
                  <th>Équipe</th>
                  <th>Réponses</th>
                  <th>Envois</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const inv = data.core.invitations.filter((i) => i.event_id === event.id);
                  const campaigns = data.flow.campaigns.filter((c) => c.eventId === event.id);
                  return (
                    <tr key={event.id}>
                      <td>
                        <Link className="flow-link" to={`/events/${event.id}`}>
                          {event.title}
                        </Link>
                        <small>{datetime(event.starts_at)}</small>
                        {event.is_cancelled && <Status value="cancelled" />}
                      </td>
                      <td>{data.core.teams.find((t) => t.id === event.team_id)?.name}</td>
                      <td>
                        <strong>
                          {inv.filter((i) => i.availability === "available").length} disponibles /{" "}
                          {inv.length}
                        </strong>
                        <small>
                          {inv.filter((i) => i.availability === "pending").length} en attente ·{" "}
                          {inv.filter((i) => i.availability === "unavailable").length} indisponibles
                        </small>
                      </td>
                      <td>
                        {campaigns.length ? (
                          <Link to={`/campaigns?eventId=${event.id}`} className="flow-link">
                            {campaigns.length} campagne(s)
                          </Link>
                        ) : (
                          <span className="flow-muted">Aucun envoi</span>
                        )}
                      </td>
                      <td>
                        <Link className="flow-button secondary" to={`/events/${event.id}`}>
                          Gérer les convocations
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun événement dans cette période.</Empty>
        )}
      </Panel>
    </Page>
  );
}
export function StatisticsPage() {
  return <Workspace>{(data) => <Statistics data={data} />}</Workspace>;
}
function Statistics({ data }: { data: WorkspaceView }) {
  const [team, setTeam] = useState("");
  const teams = data.core.teams.filter((t) => !team || t.id === team);
  const events = data.core.events.filter((e) => teams.some((t) => t.id === e.team_id));
  const matches = events.filter(
    (e) => !e.is_cancelled && e.score_for !== null && e.score_against !== null,
  );
  const invitations = data.core.invitations.filter((i) => events.some((e) => e.id === i.event_id));
  const attended = invitations.filter((i) =>
    ["on_time", "late"].includes(i.attendance || ""),
  ).length;
  const recorded = invitations.filter((i) => i.attendance !== null).length;
  const goals = matches.reduce((n, e) => n + (e.score_for || 0), 0);
  const results = teams.map((t) => {
    const es = matches.filter((e) => e.team_id === t.id);
    const own = (e: (typeof es)[number]) => e.score_for!;
    const opp = (e: (typeof es)[number]) => e.score_against!;
    return {
      name: t.name,
      id: t.id,
      played: es.length,
      wins: es.filter((e) => own(e) > opp(e)).length,
      draws: es.filter((e) => own(e) === opp(e)).length,
      losses: es.filter((e) => own(e) < opp(e)).length,
      goals: es.reduce((n, e) => n + own(e), 0),
    };
  });
  const charges = data.flow.charges.filter((c) =>
    teams.some((t) => data.core.members.some((m) => m.id === c.memberId && m.team_id === t.id)),
  );
  return (
    <Page
      title="Statistiques du club"
      description="Résultats saisis, présences constatées et suivi opérationnel."
      actions={
        <Select label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Tout le club</option>
          {data.core.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      }
    >
      <Metrics
        items={[
          { label: "Matchs avec score", value: matches.length },
          { label: "Buts marqués", value: goals },
          {
            label: "Présence constatée",
            value: recorded ? `${Math.round((attended / recorded) * 100)} %` : "—",
            detail: `${recorded} pointages renseignés`,
          },
          {
            label: "Tâches terminées",
            value: data.flow.workTasks.filter(
              (t) => t.status === "done" && (!team || t.teamId === team),
            ).length,
          },
        ]}
      />
      <Panel
        title="Bilan sportif"
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV("bilan-equipes.csv", [
                ["Équipe", "Matchs", "Victoires", "Nuls", "Défaites", "Buts"],
                ...results.map((r) => [r.name, r.played, r.wins, r.draws, r.losses, r.goals]),
              ])
            }
          >
            <Download />
            Exporter
          </Button>
        }
      >
        <div className="flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Équipe</th>
                <th>Matchs</th>
                <th>Victoires</th>
                <th>Nuls</th>
                <th>Défaites</th>
                <th>Buts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.played}</td>
                  <td>{r.wins}</td>
                  <td>{r.draws}</td>
                  <td>{r.losses}</td>
                  <td>{r.goals}</td>
                  <td>
                    <Link to={`/teams/${r.id}`} className="flow-link">
                      Statistiques des joueurs
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="flow-two-columns">
        <Panel title="Disponibilités déclarées">
          <div className="flow-bars">
            {(["available", "uncertain", "unavailable", "pending"] as const).map((status, i) => {
              const count = invitations.filter((x) => x.availability === status).length;
              return (
                <div key={status}>
                  <span>{["Disponible", "Incertain", "Indisponible", "Sans réponse"][i]}</span>
                  <div>
                    <i
                      style={{
                        width: `${invitations.length ? (count / invitations.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <Link to="/invitations" className="flow-link">
            Ouvrir les convocations
          </Link>
        </Panel>
        <Panel title="Suivi administratif">
          <Metrics
            items={[
              {
                label: "Échéances réglées",
                value: charges.filter((c) => chargeStatus(c, data.flow.transactions) === "paid")
                  .length,
              },
              {
                label: "Montant enregistré",
                value: new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(
                  charges.reduce((sum, c) => sum + paidAmount(c.id, data.flow.transactions), 0) /
                    100,
                ),
              },
            ]}
          />
          <p className="flow-muted">
            Les règlements par carte sont simulés ; les autres règlements sont des saisies
            manuelles. Les statistiques d’envoi sont également simulées.
          </p>
          <Link to="/payments" className="flow-link">
            Consulter les collectes
          </Link>
        </Panel>
      </div>
    </Page>
  );
}
