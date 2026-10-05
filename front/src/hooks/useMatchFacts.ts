import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type MatchFactCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const matchFactKeys = {
  byEvent: (eventId: string) => ["match-facts", eventId] as const,
};

export function useMatchFacts(eventId: string) {
  return useQuery({
    queryKey: matchFactKeys.byEvent(eventId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/match-facts", {
          params: { query: { event_id: eventId, limit: 100 } },
        }),
      ),
  });
}

export function useCreateMatchFact(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MatchFactCreate) =>
      unwrap(await apiClient.POST("/api/v1/match-facts", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchFactKeys.byEvent(eventId) }),
  });
}

export function useDeleteMatchFact(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (factId: string) =>
      unwrap(
        await apiClient.DELETE("/api/v1/match-facts/{fact_id}", {
          params: { path: { fact_id: factId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchFactKeys.byEvent(eventId) }),
  });
}
