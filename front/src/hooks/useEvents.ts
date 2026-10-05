import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type EventCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const eventKeys = {
  byTeam: (teamId: string) => ["events", "team", teamId] as const,
  detail: (eventId: string) => ["events", eventId] as const,
};

export function useEvents(teamId: string) {
  return useQuery({
    queryKey: eventKeys.byTeam(teamId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/events", {
          params: { query: { team_id: teamId, limit: 100 } },
        }),
      ),
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/events/{event_id}", {
          params: { path: { event_id: eventId } },
        }),
      ),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EventCreate) =>
      unwrap(await apiClient.POST("/api/v1/events", { body })),
    onSuccess: (event) =>
      queryClient.invalidateQueries({ queryKey: eventKeys.byTeam(event.team_id) }),
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) =>
      unwrap(
        await apiClient.PATCH("/api/v1/events/{event_id}", {
          params: { path: { event_id: eventId } },
          body: { is_cancelled: true },
        }),
      ),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKeys.detail(event.id), event);
      return queryClient.invalidateQueries({ queryKey: eventKeys.byTeam(event.team_id) });
    },
  });
}
