import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { unwrap } from "@/api/errors";

export function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ["stats", teamId],
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/stats/teams/{team_id}", {
          params: { path: { team_id: teamId } },
        }),
      ),
  });
}
