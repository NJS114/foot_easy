import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type EventCreate, type EventUpdate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const eventKeys = {
  byTeam: (teamId: string) => ["events", "team", teamId] as const,
  detail: (eventId: string) => ["events", eventId] as const,
};

async function fetchTeamEvents(teamId: string) {
  return unwrap(
    await apiClient.GET("/api/v1/events", { params: { query: { team_id: teamId, limit: 100 } } }),
  );
}

export function useEvents(teamId: string) {
  return useQuery({ queryKey: eventKeys.byTeam(teamId), queryFn: () => fetchTeamEvents(teamId) });
}

/** Events of several teams merged in chronological order (the club calendar). */
export function useTeamsEvents(teamIds: string[]) {
  return useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: eventKeys.byTeam(teamId),
      queryFn: () => fetchTeamEvents(teamId),
    })),
    combine: (results) => ({
      events: results
        .flatMap((result) => result.data?.items ?? [])
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
    }),
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

/** Partial update: cancellation, score, schedule… */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EventUpdate) =>
      unwrap(
        await apiClient.PATCH("/api/v1/events/{event_id}", {
          params: { path: { event_id: eventId } },
          body,
        }),
      ),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKeys.detail(event.id), event);
      return queryClient.invalidateQueries({ queryKey: ["events", "team"] });
    },
  });
}
