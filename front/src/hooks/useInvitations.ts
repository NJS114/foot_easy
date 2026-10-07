import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type InvitationReply } from "@/api/client";
import { allPages } from "@/api/pagination";
import { unwrap } from "@/api/errors";

export const invitationKeys = {
  byEvent: (eventId: string) => ["invitations", eventId] as const,
  summary: (eventId: string) => ["invitations", eventId, "summary"] as const,
};

export function useInvitations(eventId: string) {
  return useQuery({
    queryKey: invitationKeys.byEvent(eventId),
    queryFn: () =>
      allPages(async (skip) =>
        unwrap(
          await apiClient.GET("/api/v1/invitations", {
            params: { query: { event_id: eventId, skip, limit: 100 } },
          }),
        ),
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
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace"] }),
      ]),
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
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace"] }),
      ]),
  });
}

export function useRemindPending(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await apiClient.POST("/api/v1/invitations/reminders", { body: { event_id: eventId } }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace"] }),
      ]),
  });
}

export function useRecordAttendance(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invitationId,
      attendance,
    }: {
      invitationId: string;
      attendance: import("@/api/client").Invitation["attendance"];
    }) =>
      unwrap(
        await apiClient.PATCH("/api/v1/invitations/{invitation_id}/attendance", {
          params: { path: { invitation_id: invitationId } },
          body: { attendance },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: invitationKeys.byEvent(eventId) }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
        qc.invalidateQueries({ queryKey: ["workspace"] }),
      ]),
  });
}
