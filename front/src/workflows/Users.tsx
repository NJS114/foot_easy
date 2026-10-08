import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import {
  Workspace,
  Page,
  Panel,
  Metrics,
  SearchBox,
  Select,
  Feedback,
  ConfirmButton,
  Empty,
} from "./ui";
import { downloadCSV, useAction } from "./client";
import { latestFiles, memberFiles, licenseStatus } from "./document-utils";
import type { WorkspaceView } from "./types";

export function LicenseReminder({ memberId }: { memberId: string }) {
  const action = useAction();
  return (
    <div>
      <ConfirmButton
        label="Relancer la licence"
        title="Relancer ce membre pour sa licence ?"
        pending={action.isPending}
        onConfirm={async () => {
          await action.mutateAsync({ type: "license.remind", payload: { id: memberId } });
        }}
      >
        Une relance par email sera lancée en simulation. Son résultat, y compris l’absence d’adresse
        ou un échec, sera visible dans le centre des envois.
      </ConfirmButton>
      <Feedback success={action.data?.message} />
      {action.data && (
        <Link className="flow-link" to={`/campaigns/${action.data.entityId}`}>
          Voir le suivi de cette relance
        </Link>
      )}
    </div>
  );
}
export function UsersPage() {
  return <Workspace>{(data) => <Users data={data} />}</Workspace>;
}
function Users({ data }: { data: WorkspaceView }) {
  const [search, setSearch] = useState(""),
    [team, setTeam] = useState(""),
    [license, setLicense] = useState(""),
    [tasks, setTasks] = useState(""),
    [create, setCreate] = useState(false),
    [newTeam, setNewTeam] = useState(data.core.teams[0]?.id || "");
  const qc = useQueryClient();
  const summaries = data.core.members.map((member) => {
    const files = latestFiles(memberFiles(data, member.id));
    const work = data.flow.workTasks.filter((t) => t.memberId === member.id);
    return {
      member,
      files,
      submitted: files.filter((f) => f.submittedByMemberId === member.id).length,
      done: work.filter((t) => t.status === "done").length,
      pending: work.filter((t) => !["done", "cancelled"].includes(t.status)).length,
      license: licenseStatus(data, member.id),
    };
  });
  const rows = summaries.filter(
    (s) =>
      (!team || s.member.team_id === team) &&
      `${s.member.first_name} ${s.member.last_name} ${s.member.email || ""} ${s.member.license_number || ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (!license || (license === "incomplete" ? s.license !== "Complète" : s.license === license)) &&
      (!tasks || (tasks === "pending" ? s.pending > 0 : s.done > 0)),
  );
  return (
    <Page
      title="Utilisateurs"
      description="L’annuaire des membres et leur suivi administratif : documents, licences et tâches."
      actions={
        <Button onClick={() => setCreate(true)} disabled={!data.core.teams.length}>
          <Plus size={18} />
          Ajouter un membre
        </Button>
      }
    >
      <Metrics
        items={[
          { label: "Membres", value: data.core.members.length },
          {
            label: "Licences complètes",
            value: summaries.filter((s) => s.license === "Complète").length,
          },
          {
            label: "Dossiers à compléter",
            value: summaries.filter((s) => s.license !== "Complète").length,
          },
          { label: "Tâches à accomplir", value: summaries.reduce((n, s) => n + s.pending, 0) },
        ]}
      />
      <Panel title="Liste des membres">
        <div className="flow-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Nom, email ou numéro de licence"
          />
          <Select label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Toutes les équipes</option>
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Licence" value={license} onChange={(e) => setLicense(e.target.value)}>
            <option value="">Toutes</option>
            <option value="incomplete">À compléter ou vérifier</option>
            {["Complète", "À vérifier", "Pièce manquante", "À compléter", "Refusée", "Expirée"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </Select>
          <Select label="Tâches" value={tasks} onChange={(e) => setTasks(e.target.value)}>
            <option value="">Tous les membres</option>
            <option value="pending">Avec tâches à accomplir</option>
            <option value="done">Avec tâches terminées</option>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            downloadCSV("foot-easy-utilisateurs.csv", [
              [
                "Prénom",
                "Nom",
                "Équipe",
                "Email",
                "Téléphone",
                "Licence",
                "État licence",
                "Documents liés",
                "Transmis par le membre",
                "Tâches à accomplir",
                "Terminées",
              ],
              ...rows.map((s) => [
                s.member.first_name,
                s.member.last_name,
                data.core.teams.find((t) => t.id === s.member.team_id)?.name,
                s.member.email,
                s.member.phone,
                s.member.license_number,
                s.license,
                s.files.length,
                s.submitted,
                s.pending,
                s.done,
              ]),
            ])
          }
        >
          <Download size={16} />
          Exporter la liste · CSV
        </Button>
        <p className="flow-muted">
          {rows.length} membre(s) affiché(s). Ouvrez une fiche pour modifier le membre, consulter
          ses pièces et suivre ses tâches.
        </p>
        <div className="flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Équipe</th>
                <th>Licence</th>
                <th>Documents</th>
                <th>Tâches</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.member.id}>
                  <td>
                    <Link className="flow-link" to={`/users/${s.member.id}`}>
                      {s.member.first_name} {s.member.last_name}
                    </Link>
                    <small>{s.member.email || "Email à renseigner"}</small>
                    <small>{s.member.phone}</small>
                  </td>
                  <td>{data.core.teams.find((t) => t.id === s.member.team_id)?.name}</td>
                  <td>
                    <strong>{s.license}</strong>
                    <small>{s.member.license_number || "Numéro manquant"}</small>
                  </td>
                  <td>
                    <Link className="flow-link" to={`/users/${s.member.id}`}>
                      {s.files.length} liés
                    </Link>
                    <small>{s.submitted} transmis par le membre</small>
                    <small>{s.files.length - s.submitted} reçus ou rattachés</small>
                  </td>
                  <td>
                    <Link className="flow-link" to={`/tasks?memberId=${s.member.id}`}>
                      {s.pending} à accomplir · {s.done} terminées
                    </Link>
                  </td>
                  <td>
                    <Link className="flow-button secondary" to={`/users/${s.member.id}`}>
                      Ouvrir la fiche
                    </Link>
                    <LicenseReminder memberId={s.member.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty>Aucun membre ne correspond aux filtres.</Empty>}
      </Panel>
      {create && (
        <Modal title="Ajouter un membre" onClose={() => setCreate(false)}>
          <Select
            label="Équipe du nouveau membre"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
          >
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <MemberCreateForm
            key={newTeam}
            teamId={newTeam}
            onSuccess={() => {
              void qc.invalidateQueries();
              setCreate(false);
            }}
          />
        </Modal>
      )}
    </Page>
  );
}
