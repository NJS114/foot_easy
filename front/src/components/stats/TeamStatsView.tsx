import { useTranslation } from "react-i18next";
import type { PlayerStats, TeamStats } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { useTeamStats } from "@/hooks/useStats";

const RECORD_FIELDS = [
  ["played", "stats.played"],
  ["wins", "stats.wins"],
  ["draws", "stats.draws"],
  ["losses", "stats.losses"],
  ["goals_for", "stats.goalsFor"],
  ["goals_against", "stats.goalsAgainst"],
] as const satisfies readonly (readonly [keyof TeamStats, string])[];

function SeasonRecord({ stats }: { stats: TeamStats }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    wins: "#69b980",
    draws: "#e8be59",
    losses: "#df8181",
    goals_for: "#6191c8",
    goals_against: "#9196aa",
  };
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {RECORD_FIELDS.map(([field, labelKey]) => {
          const value = stats[field] as number;
          const isResult = ["wins", "draws", "losses"].includes(field);
          const ratio = stats.played ? value / stats.played : 0;
          return (
            <div key={field} className="rounded-xl border bg-card p-5 text-center">
              <dt className="mb-3 text-xs text-muted-foreground">{t(labelKey)}</dt>
              <dd
                className="mx-auto flex size-20 items-center justify-center rounded-full text-2xl font-bold"
                style={
                  isResult
                    ? {
                        background: `conic-gradient(${colors[field]} ${ratio * 360}deg, #edf0f4 0)`,
                      }
                    : { background: "#f5f8fa" }
                }
              >
                <span className="flex size-[68px] items-center justify-center rounded-full bg-white">
                  {value}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-4 flex items-center gap-3 rounded-lg border bg-card p-4">
        <span className="text-xs text-muted-foreground">Derniers résultats</span>
        {stats.form?.length ? (
          stats.form.map((result, i) => (
            <span
              key={i}
              title={{ W: "Victoire", D: "Nul", L: "Défaite" }[result]}
              className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: { W: "#64ae7d", D: "#cba749", L: "#cf7478" }[result] }}
            >
              {{ W: "V", D: "N", L: "D" }[result]}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Aucun résultat enregistré</span>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerStats }) {
  const { member } = player;
  const attendance =
    player.attendance_rate == null ? "—" : `${Math.round(player.attendance_rate * 100)} %`;
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-muted-foreground">{member.shirt_number ?? ""}</td>
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {member.first_name} {member.last_name}
      </th>
      <td className="px-3 py-2 text-center">{player.selections}</td>
      <td className="px-3 py-2 text-center font-semibold">{player.goals}</td>
      <td className="px-3 py-2 text-center">{player.assists}</td>
      <td className="px-3 py-2 text-center">
        <span className="text-amber-600">{player.yellow_cards}</span> /{" "}
        <span className="text-red-600">{player.red_cards}</span>
      </td>
      <td className="px-3 py-2 text-center">{attendance}</td>
    </tr>
  );
}

export function TeamStatsView({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTeamStats(teamId);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("stats.record")}</h2>
        <SeasonRecord stats={data} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("stats.players")}</h2>
        {!data.players.length ? (
          <EmptyState message={t("stats.noPlayers")} />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">{t("stats.player")}</th>
                  <th className="px-3 py-2">{t("stats.selections")}</th>
                  <th className="px-3 py-2">{t("stats.goals")}</th>
                  <th className="px-3 py-2">{t("stats.assists")}</th>
                  <th className="px-3 py-2">{t("stats.cards")}</th>
                  <th className="px-3 py-2">{t("stats.attendance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((player) => (
                  <PlayerRow key={player.member.id} player={player} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
