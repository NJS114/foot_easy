import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type MemberCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const memberKeys = {
  byTeam: (teamId: string) => ["members", teamId] as const,
};

export function useMembers(teamId: string) {
  return useQuery({
    queryKey: memberKeys.byTeam(teamId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/members", {
          params: { query: { team_id: teamId, limit: 100 } },
        }),
      ),
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MemberCreate) =>
      unwrap(await apiClient.POST("/api/v1/members", { body })),
    onSuccess: (member) =>
      queryClient.invalidateQueries({ queryKey: memberKeys.byTeam(member.team_id) }),
  });
}

export function useDeleteMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      unwrap(
        await apiClient.DELETE("/api/v1/members/{member_id}", {
          params: { path: { member_id: memberId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.byTeam(teamId) }),
  });
}
