import { describe, expect, it } from "vitest";
import { MATCH } from "@/test/server";
import { monthDays, toIcal } from "@/lib/calendar";
describe("Calendar export", () => {
  it("keeps UTC times, cancellations and escapes multiline event details", () => {
    const file = toIcal([
      {
        ...MATCH,
        title: "Match, amical; retour",
        notes: "Vestiaire A\nEntrée sud",
        is_cancelled: true,
      },
    ]);
    expect(file).toContain("DTSTART:20261010T130000Z\r\n");
    expect(file).toContain("SUMMARY:Match\\, amical\\; retour\r\n");
    expect(file).toContain("DESCRIPTION:Vestiaire A\\nEntrée sud\r\n");
    expect(file).toContain("STATUS:CANCELLED");
  });
  it("always starts the month grid on Monday across year boundaries", () => {
    const days = monthDays(new Date(2027, 0, 1));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days[0].getFullYear()).toBe(2026);
    expect(days[0].getDate()).toBe(28);
  });
});
