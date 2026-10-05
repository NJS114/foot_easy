export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** Converts a `datetime-local` input value (local time, no offset) to an ISO string with offset. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
