import { useTranslation } from "react-i18next";
import type { AttendanceReport, AttendanceRow } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { useAttendanceReport } from "@/hooks/useStats";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-500",
  on_time: "bg-green-600",
  late: "bg-yellow-500",
  uncertain: "bg-amber-400",
  unavailable: "bg-red-500",
  excused: "bg-orange-400",
  unexcused: "bg-red-700",
  injured: "bg-purple-500",
  pending: "bg-gray-300",
  not_invited: "bg-transparent",
};

function StatusCell({ status }: { status: string }) {
  const { t } = useTranslation();
  const label = t(`attendance.${status}`);
  const symbol = ["available", "on_time"].includes(status)
    ? "✓"
    : ["late", "uncertain"].includes(status)
      ? "◷"
      : ["unavailable", "unexcused"].includes(status)
        ? "×"
        : status === "injured"
          ? "+"
          : status === "not_invited"
            ? "—"
            : "·";
  return (
    <td className="px-2 py-3">
      <span
        className={`mx-auto flex size-6 items-center justify-center rounded-full text-sm font-bold ${STATUS_COLORS[status] ?? "bg-gray-200"} ${status === "not_invited" ? "text-slate-400" : "text-white"}`}
        title={label}
        aria-label={label}
      >
        {symbol}
      </span>
    </td>
  );
}

function AttendancePlayerRow({ row }: { row: AttendanceRow }) {
  const rate = row.invited > 0 ? Math.round((row.present / row.invited) * 100) : 0;
  return (
    <tr className="border-t">
      <th
        scope="row"
        className="sticky left-0 bg-card px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap"
      >
        {row.member.first_name} {row.member.last_name}
      </th>
      {row.cells.map((cell, i) => (
        <StatusCell key={i} status={cell} />
      ))}
      <td className="px-3 py-1.5 text-center text-xs font-semibold">
        {row.present}/{row.invited}
      </td>
      <td className="px-3 py-1.5 text-center text-xs">{rate}%</td>
    </tr>
  );
}

function AttendanceTable({ report }: { report: AttendanceReport }) {
  const { t } = useTranslation();
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left">{t("stats.player")}</th>
            {report.events.map((event) => (
              <th
                key={event.id}
                className="px-1 py-2 text-center whitespace-nowrap"
                title={event.title}
              >
                {fmtDate(event.starts_at)}
              </th>
            ))}
            <th className="px-3 py-2">{t("attendance.present")}</th>
            <th className="px-3 py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <AttendancePlayerRow key={row.member.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceGrid({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAttendanceReport(teamId);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;
  if (!data.rows.length) return <EmptyState message={t("attendance.empty")} />;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">{t("attendance.title")}</h2>
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS)
          .filter(([k]) => k !== "not_invited")
          .map(([status, bg]) => (
            <span key={status} className="flex items-center gap-1 text-xs">
              <span className={`inline-block size-3 rounded-sm ${bg}`} />
              {t(`attendance.${status}`)}
            </span>
          ))}
      </div>
      <AttendanceTable report={data} />
    </div>
  );
}
