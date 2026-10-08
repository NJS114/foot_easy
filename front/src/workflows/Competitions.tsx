import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Trophy, CalendarDays, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Competition, CompetitionTeam, Fixture, WorkspaceView } from "./types";
import { ranking } from "./domain";
import { useAction, datetime, localInput, downloadCSV } from "./client";
import {
  Workspace,
  Page,
  Panel,
  Metrics,
  Field,
  Select,
  Checkbox,
  Feedback,
  FormActions,
  Empty,
  Status,
  AuditTrail,
  ConfirmButton,
} from "./ui";
import { AttachmentPicker, DocumentPanel } from "./Documents";

export function CompetitionsPage() {
  return <Workspace>{(data) => <Competitions data={data} />}</Workspace>;
}
function Competitions({ data }: { data: WorkspaceView }) {
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  return (
    <Page
      title="Championnats"
      description="Équipes engagées, calendrier des rencontres, résultats et classement."
      actions={
        <Button onClick={() => setCreate(true)}>
          <Plus />
          Créer un championnat
        </Button>
      }
    >
      <div className="flow-card-grid">
        {data.flow.competitions.map((c) => (
          <Link to={`/competitions/${c.id}`} className="flow-card" key={c.id}>
            <div className="flow-row">
              <span className="flow-icon">
                <Trophy />
              </span>
              <Status value={c.status} />
            </div>
            <h2>{c.name}</h2>
            <p>
              {c.category} · Saison {c.season}
            </p>
            <div className="flow-row">
              <strong>{c.teams.length} équipes</strong>
              <span>
                {c.fixtures.filter((f) => f.status === "played").length} / {c.fixtures.length}{" "}
                matchs joués
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!data.flow.competitions.length && (
        <Panel>
          <Empty
            action={
              <Button onClick={() => setCreate(true)}>
                Configurer les équipes et le calendrier
              </Button>
            }
          >
            Créez votre championnat puis générez automatiquement les rencontres aller ou
            aller-retour.
          </Empty>
        </Panel>
      )}
      {create && (
        <CompetitionEditor
          data={data}
          onClose={() => setCreate(false)}
          onSaved={(id) => navigate(`/competitions/${id}`)}
        />
      )}
    </Page>
  );
}
function CompetitionEditor({
  data,
  competition,
  onClose,
  onSaved,
}: {
  data: WorkspaceView;
  competition?: Competition;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const action = useAction();
  const blank = (name = "", internalTeamId = ""): CompetitionTeam => ({
    id: crypto.randomUUID(),
    name,
    internalTeamId,
    logoId: "",
    penalty: 0,
  });
  const [teams, setTeams] = useState<CompetitionTeam[]>(
    competition?.teams || [
      blank(data.core.teams[0].name, data.core.teams[0].id),
      blank("AS Montchat"),
      blank("FC Val de Saône"),
      blank("US Pierre-Bénite"),
    ],
  );
  const [files, setFiles] = useState(competition?.attachmentIds || []);
  const patch = (i: number, p: Partial<CompetitionTeam>) =>
    setTeams((rows) => rows.map((r, index) => (index === i ? { ...r, ...p } : r)));
  return (
    <Modal
      title={competition ? "Modifier le championnat" : "Créer un championnat"}
      onClose={onClose}
      wide
    >
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await action.mutateAsync({
              type: "competition.save",
              payload: { ...f, id: competition?.id, teams, attachmentIds: files },
            });
            onSaved(result.entityId);
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <div className="flow-form-grid">
          <Field
            label="Nom du championnat"
            name="name"
            required
            defaultValue={competition?.name}
            placeholder="Championnat départemental"
          />
          <Field
            label="Saison"
            name="season"
            required
            defaultValue={competition?.season || "2026-2027"}
          />
          <Field
            label="Catégorie / groupe"
            name="category"
            defaultValue={competition?.category || "Seniors · Groupe A"}
          />
          <Field
            label="Points pour une victoire"
            name="winPoints"
            type="number"
            min="0"
            max="10"
            defaultValue={competition?.winPoints ?? 3}
          />
          <Field
            label="Points pour un nul"
            name="drawPoints"
            type="number"
            min="0"
            max="10"
            defaultValue={competition?.drawPoints ?? 1}
          />
          <Field
            label="Points pour une défaite"
            name="lossPoints"
            type="number"
            min="-5"
            max="10"
            defaultValue={competition?.lossPoints ?? 0}
          />
        </div>
        <Panel
          title={`${teams.length} équipes engagées`}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={teams.length >= 32}
              onClick={() => setTeams([...teams, blank()])}
            >
              <Plus />
              Ajouter
            </Button>
          }
        >
          <div className="competition-team-editor">
            {teams.map((team, i) => (
              <div key={team.id}>
                <Field
                  label={`Équipe ${i + 1}`}
                  required
                  value={team.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <Select
                  label="Lien avec mon club"
                  value={team.internalTeamId}
                  onChange={(e) =>
                    patch(i, {
                      internalTeamId: e.target.value,
                      ...(e.target.value
                        ? { name: data.core.teams.find((t) => t.id === e.target.value)!.name }
                        : {}),
                    })
                  }
                >
                  <option value="">Équipe extérieure</option>
                  {data.core.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Points de pénalité"
                  type="number"
                  min="0"
                  max="100"
                  value={team.penalty}
                  onChange={(e) => patch(i, { penalty: Number(e.target.value) })}
                />
                <Select
                  label="Logo"
                  value={team.logoId}
                  onChange={(e) => patch(i, { logoId: e.target.value })}
                >
                  <option value="">Sans logo</option>
                  {data.files
                    .filter((f) => f.mime.startsWith("image/") && f.status !== "archived")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={teams.length <= 2}
                  aria-label={`Retirer ${team.name || `équipe ${i + 1}`}`}
                  onClick={() => setTeams(teams.filter((_, index) => index !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </Panel>
        <AttachmentPicker
          data={data}
          selected={files}
          onChange={setFiles}
          label="Règlement, logos et documents"
        />
        <p className="flow-muted">
          Les rencontres de vos équipes seront ajoutées au calendrier du club. Les égalités sont
          départagées par différence de buts, puis buts marqués.
        </p>
        <Feedback error={action.error} />
        <FormActions
          pending={action.isPending}
          onClose={onClose}
          label="Enregistrer le championnat"
        />
      </form>
    </Modal>
  );
}
export function CompetitionDetailPage() {
  const { competitionId = "" } = useParams();
  return <Workspace>{(data) => <CompetitionDetail data={data} id={competitionId} />}</Workspace>;
}
function CompetitionDetail({ data, id }: { data: WorkspaceView; id: string }) {
  const c = data.flow.competitions.find((c) => c.id === id);
  const action = useAction();
  const [edit, setEdit] = useState(false),
    [fixtureId, setFixture] = useState<string | null>(null),
    [round, setRound] = useState("");
  if (!c) return <Empty>Championnat introuvable.</Empty>;
  const table = ranking(c),
    selected = c.fixtures.find((f) => f.id === fixtureId);
  return (
    <Page
      title={c.name}
      back="/competitions"
      description={`${c.category} · ${c.season}`}
      actions={
        <>
          <Status value={c.status} />
          {c.status === "draft" && (
            <Button variant="outline" onClick={() => setEdit(true)}>
              Modifier
            </Button>
          )}
          {c.status === "active" && (
            <ConfirmButton
              label="Clôturer le championnat"
              title="Clôturer la compétition ?"
              onConfirm={() => action.mutateAsync({ type: "competition.finish", payload: { id } })}
              pending={action.isPending}
            >
              Toutes les rencontres doivent être jouées ou annulées. Le classement sera conservé.
            </ConfirmButton>
          )}
        </>
      }
    >
      <Feedback error={action.error} />
      <Metrics
        items={[
          { label: "Équipes", value: c.teams.length },
          { label: "Rencontres", value: c.fixtures.length },
          { label: "Jouées", value: c.fixtures.filter((f) => f.status === "played").length },
          { label: "Reportées", value: c.fixtures.filter((f) => f.status === "postponed").length },
        ]}
      />
      {c.status === "draft" && (
        <Panel title="Générer le calendrier">
          <form
            className="flow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate({
                type: "competition.generate",
                payload: {
                  id,
                  startsAt: new Date(String(f.get("startsAt"))).toISOString(),
                  intervalDays: Number(f.get("intervalDays")),
                  returnLeg: f.get("returnLeg") === "on",
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
              });
            }}
          >
            <div className="flow-form-grid">
              <Field
                label="Première journée · heure locale"
                type="datetime-local"
                required
                name="startsAt"
                defaultValue={localInput(new Date(Date.now() + 7 * 86400000).toISOString())}
              />
              <Field
                label="Jours entre deux journées"
                type="number"
                min="1"
                max="60"
                required
                name="intervalDays"
                defaultValue="7"
              />
            </div>
            <Checkbox label="Rencontres aller-retour" name="returnLeg" defaultChecked />
            <p className="flow-muted">
              Chaque équipe rencontre les autres une fois par phase. Une équipe est exemptée par
              journée si le nombre de participants est impair.
            </p>
            <Button disabled={action.isPending}>
              <CalendarDays />
              Générer les rencontres
            </Button>
          </form>
        </Panel>
      )}
      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking">Classement</TabsTrigger>
          <TabsTrigger value="fixtures">Matchs & résultats</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="ranking">
          <Panel
            title="Classement calculé"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV("classement.csv", [
                    ["Rang", "Équipe", "Joués", "V", "N", "D", "BP", "BC", "Diff", "Points"],
                    ...table.map((t, i) => [
                      i + 1,
                      t.name,
                      t.played,
                      t.wins,
                      t.draws,
                      t.losses,
                      t.goalsFor,
                      t.goalsAgainst,
                      t.difference,
                      t.points,
                    ]),
                  ])
                }
              >
                <Download />
                Exporter
              </Button>
            }
          >
            <div className="flow-table-wrap">
              <table className="flow-table standings">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Équipe</th>
                    <th>Pts</th>
                    <th>J</th>
                    <th>V</th>
                    <th>N</th>
                    <th>D</th>
                    <th>BP</th>
                    <th>BC</th>
                    <th>Diff.</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((t, i) => {
                    const team = c.teams.find((x) => x.id === t.id);
                    const logo = data.files.find((f) => f.id === team?.logoId);
                    return (
                      <tr key={t.id} className={team?.internalTeamId ? "own-team" : ""}>
                        <td>{i + 1}</td>
                        <td>
                          <span className="standing-team">
                            {logo && <img src={logo.url} alt="" />}
                            <strong>{t.name}</strong>
                            {t.penalty > 0 && <small>−{t.penalty} pts</small>}
                          </span>
                        </td>
                        <td>
                          <strong>{t.points}</strong>
                        </td>
                        <td>{t.played}</td>
                        <td>{t.wins}</td>
                        <td>{t.draws}</td>
                        <td>{t.losses}</td>
                        <td>{t.goalsFor}</td>
                        <td>{t.goalsAgainst}</td>
                        <td>
                          {t.difference > 0 ? "+" : ""}
                          {t.difference}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="flow-muted">
              Victoire : {c.winPoints} pts · Nul : {c.drawPoints} pt(s) · Défaite : {c.lossPoints}{" "}
              pt(s). Les matchs annulés ne comptent pas.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="fixtures">
          <Panel
            title="Rencontres"
            actions={
              <Select label="Journée" value={round} onChange={(e) => setRound(e.target.value)}>
                <option value="">Toutes</option>
                {[...new Set(c.fixtures.map((f) => f.round))].map((r) => (
                  <option key={r} value={r}>
                    Journée {r}
                  </option>
                ))}
              </Select>
            }
          >
            {c.fixtures.length ? (
              <div className="fixture-list">
                {c.fixtures
                  .filter((f) => !round || f.round === Number(round))
                  .map((f) => (
                    <article key={f.id}>
                      <div>
                        <small>
                          J{f.round} · {datetime(f.startsAt)}
                        </small>
                        <strong>
                          {c.teams.find((t) => t.id === f.homeId)?.name}{" "}
                          <span className="fixture-score">
                            {f.homeScore ?? "–"} : {f.awayScore ?? "–"}
                          </span>{" "}
                          {c.teams.find((t) => t.id === f.awayId)?.name}
                        </strong>
                        <small>{f.location}</small>
                      </div>
                      <Status value={f.status} />
                      <div className="flow-actions">
                        {f.eventId && (
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/events/${f.eventId}`}>Fiche match</Link>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={c.status !== "active"}
                          onClick={() => setFixture(f.id)}
                        >
                          Saisir / modifier
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <Empty>Générez le calendrier pour préparer les journées.</Empty>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel data={data} entityType="competition" entityId={id} />
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Historique du championnat">
            <AuditTrail data={data} entityId={id} />
          </Panel>
        </TabsContent>
      </Tabs>
      {edit && (
        <CompetitionEditor
          data={data}
          competition={c}
          onClose={() => setEdit(false)}
          onSaved={() => {}}
        />
      )}
      {selected && (
        <FixtureEditor
          data={data}
          competition={c}
          fixture={selected}
          onClose={() => setFixture(null)}
        />
      )}
    </Page>
  );
}
function FixtureEditor({
  data,
  competition,
  fixture,
  onClose,
}: {
  data: WorkspaceView;
  competition: Competition;
  fixture: Fixture;
  onClose: () => void;
}) {
  const action = useAction();
  const [status, setStatus] = useState(fixture.status),
    [files, setFiles] = useState(fixture.attachmentIds);
  return (
    <Modal
      title={`${competition.teams.find((t) => t.id === fixture.homeId)?.name} / ${competition.teams.find((t) => t.id === fixture.awayId)?.name}`}
      onClose={onClose}
    >
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await action.mutateAsync({
              type: "competition.fixture",
              payload: {
                id: competition.id,
                fixtureId: fixture.id,
                status,
                startsAt: new Date(String(f.get("startsAt"))).toISOString(),
                location: f.get("location"),
                homeScore: Number(f.get("homeScore")),
                awayScore: Number(f.get("awayScore")),
                attachmentIds: files,
              },
            });
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <Select
          label="État du match"
          value={status}
          onChange={(e) => setStatus(e.target.value as Fixture["status"])}
        >
          <option value="scheduled">Programmé</option>
          <option value="postponed">Reporté</option>
          <option value="played">Joué</option>
          <option value="cancelled">Annulé</option>
        </Select>
        <Field
          label="Date et heure"
          type="datetime-local"
          required
          name="startsAt"
          defaultValue={localInput(fixture.startsAt)}
        />
        <Field label="Lieu" name="location" defaultValue={fixture.location} />
        {status === "played" && (
          <div className="flow-form-grid">
            <Field
              label="Buts domicile"
              type="number"
              min="0"
              max="99"
              name="homeScore"
              required
              defaultValue={fixture.homeScore ?? 0}
            />
            <Field
              label="Buts extérieur"
              type="number"
              min="0"
              max="99"
              name="awayScore"
              required
              defaultValue={fixture.awayScore ?? 0}
            />
          </div>
        )}
        <AttachmentPicker
          data={data}
          selected={files}
          onChange={setFiles}
          label="Feuille de match, photos et justificatifs"
        />
        <Feedback error={action.error} />
        <FormActions pending={action.isPending} onClose={onClose} />
      </form>
    </Modal>
  );
}
