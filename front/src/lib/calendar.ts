import type { Event } from "@/api/client";
import { downloadBlob } from "@/lib/download";
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from(
    { length: 42 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i),
  );
}
const escapeIcal = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const utcStamp = (date: string) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
function foldLine(line: string) {
  let result = "",
    width = 0;
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    if (width + bytes > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += bytes;
  }
  return result;
}
export function toIcal(events: Event[]) {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Foot Easy//Calendrier//FR",
      "CALSCALE:GREGORIAN",
      ...events.flatMap((event) => [
        "BEGIN:VEVENT",
        `UID:${event.id}@foot-easy`,
        `DTSTAMP:${utcStamp(new Date().toISOString())}`,
        `DTSTART:${utcStamp(event.starts_at)}`,
        ...(event.ends_at ? [`DTEND:${utcStamp(event.ends_at)}`] : []),
        `SUMMARY:${escapeIcal(event.title)}`,
        ...(event.location ? [`LOCATION:${escapeIcal(event.location)}`] : []),
        ...(event.notes ? [`DESCRIPTION:${escapeIcal(event.notes)}`] : []),
        `STATUS:${event.is_cancelled ? "CANCELLED" : "CONFIRMED"}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
export function exportCalendar(events: Event[]) {
  downloadBlob(
    new Blob([toIcal(events)], { type: "text/calendar;charset=utf-8" }),
    "foot-easy-calendrier.ics",
  );
}
