import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssignmentResponse, Member, TeamTaskResponse } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useMembers } from "@/hooks/useMembers";
import {
  useAddDefaultTasks,
  useAssignTask,
  useEventAssignments,
  useTeamTasks,
  useUnassignTask,
} from "@/hooks/useTasks";

function AssignmentRow({
  assignment,
  onDelete,
}: {
  assignment: AssignmentResponse;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex-1">
        <span className="font-medium">{assignment.task.name}</span>
        <span className="text-muted-foreground">
          {" — "}
          {assignment.member.first_name} {assignment.member.last_name}
        </span>
      </span>
      <button onClick={onDelete} className="text-destructive hover:text-destructive/80">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function TaskAssigner({ eventId, teamId }: { eventId: string; teamId: string }) {
  const { t } = useTranslation();
  const tasksQuery = useTeamTasks(teamId);
  const membersQuery = useMembers(teamId);
  const assignmentsQuery = useEventAssignments(eventId);
  const assignMut = useAssignTask(eventId);
  const unassignMut = useUnassignTask(eventId);
  const defaultsMut = useAddDefaultTasks();

  const [taskId, setTaskId] = useState("");
  const [memberId, setMemberId] = useState("");

  const tasks: TeamTaskResponse[] = tasksQuery.data?.items ?? [];
  const members: Member[] = membersQuery.data?.items ?? [];
  const assignments: AssignmentResponse[] = assignmentsQuery.data ?? [];

  const isLoading = tasksQuery.isLoading || membersQuery.isLoading || assignmentsQuery.isLoading;
  const error = tasksQuery.error || membersQuery.error || assignmentsQuery.error;

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <ListChecks className="size-4" /> {t("tasks.title")}
        </h3>
        {!tasks.length && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => defaultsMut.mutate(teamId)}
            disabled={defaultsMut.isPending}
          >
            {t("tasks.addDefaults")}
          </Button>
        )}
      </div>

      {assignments.length === 0 && <EmptyState message={t("tasks.empty")} />}
      <div className="flex flex-col gap-2">
        {assignments.map((a) => (
          <AssignmentRow key={a.id} assignment={a} onDelete={() => unassignMut.mutate(a.id)} />
        ))}
      </div>

      {tasks.length > 0 && members.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <NativeSelect value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">{t("tasks.pickTask")}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">{t("tasks.pickMember")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!taskId || !memberId || assignMut.isPending}
            onClick={() => {
              assignMut.mutate({ event_id: eventId, team_task_id: taskId, member_id: memberId });
              setTaskId("");
              setMemberId("");
            }}
          >
            <Plus className="mr-1 size-4" /> {t("tasks.assign")}
          </Button>
        </div>
      )}
    </div>
  );
}
