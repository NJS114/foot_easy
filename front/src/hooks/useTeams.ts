import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type TeamCreate } from "@/api/client";
import { allPages } from "@/api/pagination";
import { unwrap } from "@/api/errors";

export const teamKeys = {
  all: ["teams"] as const,
  byClub: (clubId: string) => ["teams", "club", clubId] as const,
  detail: (teamId: string) => ["teams", teamId] as const,
};

export function useTeams(clubId: string) {
  return useQuery({
    queryKey: teamKeys.byClub(clubId),
    queryFn: () =>
      allPages(async (skip) =>
        unwrap(
          await apiClient.GET("/api/v1/teams", {
            params: { query: { club_id: clubId, skip, limit: 100 } },
          }),
        ),
      ),
  });
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: teamKeys.detail(teamId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/teams/{team_id}", { params: { path: { team_id: teamId } } }),
      ),
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TeamCreate) => unwrap(await apiClient.POST("/api/v1/teams", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}
