import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type MemberCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const memberKeys = {
  byTeam: (teamId: string) => ["members", teamId] as const,
  byClub: (clubId: string) => ["members", "club", clubId] as const,
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

export function useClubMembers(
  clubId: string,
  params?: { search?: string; role?: string; sort?: string },
) {
  return useQuery({
    queryKey: [...memberKeys.byClub(clubId), params],
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/members", {
          params: {
            query: {
              club_id: clubId,
              limit: 200,
              ...(params?.search ? { search: params.search } : {}),
              ...(params?.role ? { role: params.role as never } : {}),
              ...(params?.sort ? { sort: params.sort as never } : {}),
            },
          },
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

export function useImportMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, file }: { teamId: string; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiClient.baseUrl}/api/v1/members/import?team_id=${teamId}`, {
        method: "POST",
        body,
      });
      if (!response.ok) throw await response.json();
      return (await response.json()) as { created: number; skipped: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useExportMembers() {
  return useMutation({
    mutationFn: async (teamId: string) => {
      const response = await fetch(`${apiClient.baseUrl}/api/v1/members/export?team_id=${teamId}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "membres.csv";
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
