import { WorkflowError } from "./domain";
export function addLocalDays(value: string, days: number, timeZone = "Europe/Paris") {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new WorkflowError("Fuseau horaire invalide.");
  }
  const wall = (date: Date) => {
    const p = Object.fromEntries(formatter.formatToParts(date).map((x) => [x.type, x.value]));
    return Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
  };
  const input = new Date(value),
    target = wall(input) + days * 86400000;
  let candidate = new Date(target);
  for (let i = 0; i < 4; i++) {
    const difference = target - wall(candidate);
    if (!difference) break;
    candidate = new Date(candidate.getTime() + difference);
  }
  if (wall(candidate) !== target)
    throw new WorkflowError(
      "Un horaire récurrent tombe dans une heure inexistante du changement d’heure. Décalez le créneau.",
    );
  return candidate.toISOString();
}
export function addMonthsClamped(value: string, months: number) {
  const date = new Date(value + "T12:00:00Z"),
    day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function calendarDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
