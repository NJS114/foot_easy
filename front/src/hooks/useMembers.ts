import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  apiClient,
  type ImportReport,
  type Member,
  type MemberCreate,
  type Schemas,
} from "@/api/client";
import { unwrap } from "@/api/errors";
import { allPages } from "@/api/pagination";
import { downloadBlob } from "@/lib/download";

export const memberKeys = {
  byTeam: (teamId: string) => ["members", teamId] as const,
  byClub: (clubId: string) => ["members", "club", clubId] as const,
};
export type DirectoryFilters = {
  search?: string;
  role?: Member["role"];
  sort?: Schemas["MemberSort"];
  team_id?: string;
};
export function useMembers(teamId: string) {
  return useQuery({
    queryKey: memberKeys.byTeam(teamId),
    enabled: !!teamId,
    queryFn: () =>
      allPages(async (skip) =>
        unwrap(
          await apiClient.GET("/api/v1/members", {
            params: { query: { team_id: teamId, skip, limit: 100 } },
          }),
        ),
      ),
  });
}
export function useClubMembers(clubId: string, params?: DirectoryFilters) {
  return useQuery({
    queryKey: [...memberKeys.byClub(clubId), params],
    queryFn: () =>
      allPages(async (skip) =>
        unwrap(
          await apiClient.GET("/api/v1/members", {
            params: { query: { club_id: clubId, skip, limit: 100, ...params } },
          }),
        ),
      ),
  });
}
export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MemberCreate) =>
      unwrap(await apiClient.POST("/api/v1/members", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}
export function useUpdateMember(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["MemberUpdate"]) =>
      unwrap(
        await apiClient.PATCH("/api/v1/members/{member_id}", {
          params: { path: { member_id: memberId } },
          body,
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["members"] }),
        qc.invalidateQueries({ queryKey: ["invitations"] }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  });
}
export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      unwrap(
        await apiClient.DELETE("/api/v1/members/{member_id}", {
          params: { path: { member_id: memberId } },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["members"] }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
        qc.invalidateQueries({ queryKey: ["invitations"] }),
      ]),
  });
}
export function useImportMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, file }: { teamId: string; file: File }): Promise<ImportReport> => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/members/import?team_id=${encodeURIComponent(teamId)}`,
        { method: "POST", body },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import impossible");
      }
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}
export function useExportMembers() {
  return useMutation({
    mutationFn: async (filters: DirectoryFilters & { club_id: string }) => {
      const params = new URLSearchParams(
        Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]),
      );
      const response = await fetch(`${API_BASE_URL}/api/v1/members/export?${params}`);
      if (!response.ok) throw new Error("Impossible d’exporter les membres.");
      downloadBlob(await response.blob(), "membres.csv");
    },
  });
}
