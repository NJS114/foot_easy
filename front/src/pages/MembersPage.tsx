import { Download, Pencil, Plus, Search, Upload, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Member, Schemas } from "@/api/client";
import { MEMBER_ROLES } from "@/lib/members";
import { MemberCreateForm } from "@/components/members/MemberCreateForm";
import { FormError, FormField } from "@/components/FormField";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentClub } from "@/hooks/useClubs";
import { useClubMembers, useExportMembers, useImportMembers } from "@/hooks/useMembers";
import { useTeams } from "@/hooks/useTeams";

export function MembersPage() {
  const { t } = useTranslation(),
    club = useCurrentClub();
  const teamsQuery = useTeams(club.id),
    teams = teamsQuery.data?.items ?? [];
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Member["role"] | "">("");
  const [sort, setSort] = useState<Schemas["MemberSort"]>("last_name");
  const [teamFilter, setTeamFilter] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const filters = {
    search: search || undefined,
    role: role || undefined,
    sort,
    team_id: teamFilter || undefined,
  };
  const { data, isLoading, error } = useClubMembers(club.id, filters);
  const importMut = useImportMembers(),
    exportMut = useExportMembers();
  const members = data?.items ?? [];
  return (
    <div className="flex flex-col gap-6">
      <header className="page-heading">
        <div>
          <h1>{t("directory.title")}</h1>
          <p className="page-subtitle">Sur le terrain ou au bureau, tout le monde a sa place.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Ajouter un membre
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="stat-icon">
            <Users size={20} />
          </span>
          <div>
            <strong className="text-lg">{data?.total ?? "—"} membres</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {teamFilter ? teams.find((team) => team.id === teamFilter)?.name : club.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            aria-label="Fichier des membres"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && teamFilter) importMut.mutate({ teamId: teamFilter, file });
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!teamFilter || importMut.isPending}
            title={
              !teamFilter ? "Sélectionnez une équipe avant d’importer" : "CSV ou XLSX, 2 Mo maximum"
            }
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Importer CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exportMut.isPending || !members.length}
            onClick={() => exportMut.mutate({ club_id: club.id, ...filters })}
          >
            <Download />
            {t("directory.export")}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap gap-3 border-b p-5">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              aria-label="Rechercher un membre"
              placeholder={t("directory.search")}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <NativeSelect
            className="w-full sm:w-auto"
            aria-label="Filtrer par équipe"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">Toutes les équipes</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-full sm:w-auto"
            aria-label="Filtrer par rôle"
            value={role}
            onChange={(e) => setRole(e.target.value as Member["role"] | "")}
          >
            <option value="">Tous les rôles</option>
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-full sm:w-auto"
            aria-label="Trier les membres"
            value={sort}
            onChange={(e) => setSort(e.target.value as Schemas["MemberSort"])}
          >
            <option value="last_name">Nom A → Z</option>
            <option value="first_name">Prénom A → Z</option>
            <option value="role">Rôle</option>
            <option value="shirt_number">N° de maillot</option>
          </NativeSelect>
        </div>
        {importMut.isSuccess && (
          <p role="status" className="p-4 text-sm text-primary">
            {importMut.data.imported} membre(s) importé(s) · {importMut.data.skipped} doublon(s)
            ignoré(s).
          </p>
        )}
        <FormError error={importMut.error || exportMut.error} />
        {isLoading ? (
          <LoadingState />
        ) : error || teamsQuery.error ? (
          <ErrorState error={error || teamsQuery.error} />
        ) : !members.length ? (
          <EmptyState message={t("directory.empty")} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Rôle / Équipe</th>
                  <th>Coordonnées</th>
                  <th>Licence</th>
                  <th>Maillot</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link
                        to={`/members/${member.id}`}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="member-avatar">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </span>
                        <span className="whitespace-nowrap font-semibold">
                          {member.first_name} {member.last_name}
                          {member.position && (
                            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                              {t(`positions.${member.position}`)}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Badge variant="secondary">{t(`roles.${member.role}`)}</Badge>
                      <Link
                        to={`/teams/${member.team_id}`}
                        className="mt-2 block whitespace-nowrap text-[11px] text-muted-foreground hover:underline"
                      >
                        {teams.find((team) => team.id === member.team_id)?.name}
                      </Link>
                    </td>
                    <td>
                      <span className="block">{member.email || "—"}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {member.phone || ""}
                      </span>
                    </td>
                    <td>
                      <span
                        className={member.license_number ? "text-primary" : "text-muted-foreground"}
                      >
                        {member.license_number || "À renseigner"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {member.jersey_size || "—"}
                      {member.shirt_number && (
                        <span className="ml-2 text-muted-foreground">#{member.shirt_number}</span>
                      )}
                    </td>
                    <td>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Modifier ${member.first_name} ${member.last_name}`}
                        onClick={() => setEditing(member)}
                      >
                        <Pencil />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t px-5 py-4 text-xs text-muted-foreground">
          {teamFilter
            ? "Import CSV ou XLSX : prénom et nom obligatoires, taille maximale 2 Mo."
            : "Sélectionnez une équipe pour y importer un fichier de membres."}
        </div>
      </div>
      {editing && (
        <Modal
          title={`Fiche de ${editing.first_name} ${editing.last_name}`}
          onClose={() => setEditing(null)}
        >
          <MemberCreateForm
            teamId={editing.team_id}
            member={editing}
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      )}
      {adding && (
        <Modal title="Ajouter un membre" onClose={() => setAdding(false)}>
          {teamsQuery.isLoading ? (
            <LoadingState />
          ) : teamsQuery.error ? (
            <ErrorState error={teamsQuery.error} />
          ) : teams.length ? (
            <>
              <div className="mb-5">
                <FormField label="Équipe ou groupe">
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={newTeam || teamFilter || teams[0].id}
                      onChange={(e) => setNewTeam(e.target.value)}
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              </div>
              <MemberCreateForm
                teamId={newTeam || teamFilter || teams[0].id}
                onSuccess={() => setAdding(false)}
              />
            </>
          ) : (
            <>
              <p className="mb-4 text-sm">
                Créez d’abord une équipe ou un groupe pour accueillir vos membres.
              </p>
              <Button asChild>
                <Link to="/teams">Créer une équipe</Link>
              </Button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
