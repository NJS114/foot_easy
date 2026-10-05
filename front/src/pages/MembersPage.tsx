import { Download, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Member } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentClub } from "@/hooks/useClubs";
import { useClubMembers, useExportMembers, useImportMembers } from "@/hooks/useMembers";
import { useTeams } from "@/hooks/useTeams";

const ROLES = [
  "player",
  "coach",
  "staff",
  "president",
  "secretary",
  "treasurer",
  "technical_director",
  "volunteer",
  "referee",
] as const;
const SORTS = ["last_name", "-last_name", "first_name", "-first_name", "role", "-role"] as const;
const SORT_LABELS: Record<string, string> = {
  last_name: "Nom A→Z",
  "-last_name": "Nom Z→A",
  first_name: "Prénom A→Z",
  "-first_name": "Prénom Z→A",
  role: "Rôle A→Z",
  "-role": "Rôle Z→A",
};

function MemberCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {member.shirt_number ?? member.first_name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.first_name} {member.last_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email ?? ""}</p>
      </div>
      <Badge variant="secondary">{t(`roles.${member.role}`)}</Badge>
    </div>
  );
}

function ImportExportBar({
  teamFilter,
  onImport,
  onExport,
}: {
  teamFilter: string;
  onImport: (file: File) => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!teamFilter}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mr-1 size-4" /> {t("directory.import")}
      </Button>
      <Button variant="outline" size="sm" disabled={!teamFilter} onClick={onExport}>
        <Download className="mr-1 size-4" /> {t("directory.export")}
      </Button>
    </div>
  );
}

export function MembersPage() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  const teams = useTeams(club.id).data?.items ?? [];
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("last_name");
  const [teamFilter, setTeamFilter] = useState("");
  const { data, isLoading, error } = useClubMembers(club.id, { search, role, sort });
  const importMut = useImportMembers();
  const exportMut = useExportMembers();

  const members = data?.items ?? [];
  const filtered = teamFilter ? members.filter((m: Member) => m.team_id === teamFilter) : members;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("directory.title")}</h1>
        <ImportExportBar
          teamFilter={teamFilter}
          onImport={(file) => importMut.mutate({ teamId: teamFilter, file })}
          onExport={() => teamFilter && exportMut.mutate(teamFilter)}
        />
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t("directory.search")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <NativeSelect value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="">
            {t("common.all")} — {t("directory.allTeams")}
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t("directory.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {importMut.isSuccess && (
        <p className="text-sm text-green-600">
          {t("directory.importOk", { count: importMut.data.created })}
        </p>
      )}
      {importMut.isError && <p className="text-sm text-destructive">{t("directory.importFail")}</p>}

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && !filtered.length && <EmptyState message={t("directory.empty")} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m: Member) => (
          <MemberCard key={m.id} member={m} />
        ))}
      </div>
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("directory.count", { count: filtered.length })}
        </p>
      )}
    </div>
  );
}
