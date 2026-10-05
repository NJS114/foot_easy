import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentClub } from "@/hooks/useClubs";
import { useTeams } from "@/hooks/useTeams";

export function TeamList() {
  const { t } = useTranslation();
  const club = useCurrentClub();
  const { data, isLoading, error } = useTeams(club.id);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("teams.empty")} />;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.items.map((team) => (
        <li key={team.id}>
          <Link to={`/teams/${team.id}`} className="block rounded-lg focus-visible:ring-2">
            <Card
              className="border-t-4 transition-shadow hover:shadow-md"
              style={{ borderTopColor: team.color }}
            >
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
                <CardDescription className="flex gap-2">
                  <Badge variant="secondary">{t(`categories.${team.category}`)}</Badge>
                  <span>{team.season}</span>
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
