import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type InvitationReply } from "@/api/client";
import { unwrap } from "@/api/errors";

export const invitationKeys = {
  byEvent: (eventId: string) => ["invitations", eventId] as const,
  summary: (eventId: string) => ["invitations", eventId, "summary"] as const,
};

export function useInvitations(eventId: string) {
  return useQuery({
    queryKey: invitationKeys.byEvent(eventId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/invitations", {
          params: { query: { event_id: eventId, limit: 100 } },
        }),
      ),
  });
}

export function useAvailabilitySummary(eventId: string) {
  return useQuery({
    queryKey: invitationKeys.summary(eventId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/invitations/summary", {
          params: { query: { event_id: eventId } },
        }),
      ),
  });
}

export function useInviteRoster(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.POST("/api/v1/invitations", { body: { event_id: eventId } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
  });
}

export function useReplyInvitation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, body }: { invitationId: string; body: InvitationReply }) =>
      unwrap(
        await apiClient.PATCH("/api/v1/invitations/{invitation_id}", {
          params: { path: { invitation_id: invitationId } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
  });
}

export function useRemindPending(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await apiClient.POST("/api/v1/invitations/reminders", { body: { event_id: eventId } }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
  });
}
