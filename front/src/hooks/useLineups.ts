import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type LineupWrite } from "@/api/client";
import { ApiError, unwrap } from "@/api/errors";

export const lineupKeys = {
  formations: ["formations"] as const,
  byEvent: (eventId: string) => ["lineups", eventId] as const,
};

export function useFormations() {
  return useQuery({
    queryKey: lineupKeys.formations,
    queryFn: async () => unwrap(await apiClient.GET("/api/v1/lineups/formations", {})),
    staleTime: Infinity,
  });
}

/** Resolves to null while the event has no lineup yet. */
export function useLineup(eventId: string) {
  return useQuery({
    queryKey: lineupKeys.byEvent(eventId),
    queryFn: async () => {
      try {
        return unwrap(
          await apiClient.GET("/api/v1/lineups/{event_id}", {
            params: { path: { event_id: eventId } },
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.code === "lineup_not_found") return null;
        throw error;
      }
    },
  });
}

export function useSaveLineup(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LineupWrite) =>
      unwrap(
        await apiClient.PUT("/api/v1/lineups/{event_id}", {
          params: { path: { event_id: eventId } },
          body,
        }),
      ),
    onSuccess: (lineup) => queryClient.setQueryData(lineupKeys.byEvent(eventId), lineup),
  });
}
