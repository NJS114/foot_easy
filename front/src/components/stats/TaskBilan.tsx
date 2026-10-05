import { useTranslation } from "react-i18next";
import type { TaskReport, TaskRow } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { useTaskReport } from "@/hooks/useStats";

function TaskPlayerRow({ row }: { row: TaskRow }) {
  return (
    <tr className="border-t">
      <th
        scope="row"
        className="sticky left-0 bg-card px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap"
      >
        {row.member.first_name} {row.member.last_name}
      </th>
      {row.counts.map((count, i) => (
        <td key={i} className="px-3 py-1.5 text-center text-sm">
          {count || "—"}
        </td>
      ))}
      <td className="px-3 py-1.5 text-center text-sm font-bold">{row.total}</td>
    </tr>
  );
}

function TaskTable({ report }: { report: TaskReport }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left">{t("stats.player")}</th>
            {report.tasks.map((task) => (
              <th key={task.id} className="px-3 py-2 text-center whitespace-nowrap">
                {task.name}
              </th>
            ))}
            <th className="px-3 py-2 text-center">{t("tasks.total")}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <TaskPlayerRow key={row.member.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaskBilan({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTaskReport(teamId);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;
  if (!data.rows.length) return <EmptyState message={t("tasks.emptyReport")} />;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">{t("tasks.bilan")}</h2>
      <TaskTable report={data} />
    </div>
  );
}
