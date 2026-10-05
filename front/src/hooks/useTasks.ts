import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type AssignmentCreate, type TeamTaskCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const taskKeys = {
  byTeam: (teamId: string) => ["tasks", teamId] as const,
  assignments: (eventId: string) => ["taskAssignments", eventId] as const,
};

export function useTeamTasks(teamId: string) {
  return useQuery({
    queryKey: taskKeys.byTeam(teamId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/tasks", {
          params: { query: { team_id: teamId, limit: 100 } },
        }),
      ),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: TeamTaskCreate) =>
      unwrap(await apiClient.POST("/api/v1/tasks", { body })),
    onSuccess: (task) => qc.invalidateQueries({ queryKey: taskKeys.byTeam(task.team_id) }),
  });
}

export function useAddDefaultTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) =>
      unwrap(await apiClient.POST("/api/v1/tasks/defaults", { body: { team_id: teamId } })),
    onSuccess: (_data, teamId) => qc.invalidateQueries({ queryKey: taskKeys.byTeam(teamId) }),
  });
}

export function useEventAssignments(eventId: string) {
  return useQuery({
    queryKey: taskKeys.assignments(eventId),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/tasks/assignments", {
          params: { query: { event_id: eventId } },
        }),
      ),
  });
}

export function useAssignTask(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssignmentCreate) =>
      unwrap(await apiClient.POST("/api/v1/tasks/assignments", { body })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: taskKeys.assignments(eventId) }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  });
}

export function useUnassignTask(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) =>
      unwrap(
        await apiClient.DELETE("/api/v1/tasks/assignments/{assignment_id}", {
          params: { path: { assignment_id: assignmentId } },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: taskKeys.assignments(eventId) }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  });
}

export function useDeleteTask(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) =>
      unwrap(
        await apiClient.DELETE("/api/v1/tasks/{task_id}", {
          params: { path: { task_id: taskId } },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: taskKeys.byTeam(teamId) }),
        qc.invalidateQueries({ queryKey: ["taskAssignments"] }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  });
}
