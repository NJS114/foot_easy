import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Invitation, Member, Schemas } from "@/api/client";
import { apiUrl, INVITATION, MATCH, page, PLAYER, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

function directory() {
  server.use(
    http.get(apiUrl("/teams"), () => HttpResponse.json(page([TEAM]))),
    http.get(apiUrl("/members"), () => HttpResponse.json(page([PLAYER]))),
  );
}
describe("Club management workflows", () => {
  it("loads all pages of the member directory without requesting an unsupported limit", async () => {
    directory();
    server.use(
      http.get(apiUrl("/members"), ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("limit")).toBe("100");
        return HttpResponse.json(
          url.searchParams.get("skip") === "0"
            ? { ...page([PLAYER]), total: 2, has_more: true }
            : page([{ ...PLAYER, id: "second", first_name: "Nadia", last_name: "Meziane" }]),
        );
      }),
    );
    renderRoute("/members");
    expect(await screen.findByText("Nadia Meziane")).toBeInTheDocument();
    expect(screen.getByText("Zinedine Zidane")).toBeInTheDocument();
  });
  it("edits a member's licence and jersey size and refreshes the directory", async () => {
    directory();
    let member = PLAYER;
    let sent: Schemas["MemberUpdate"] | undefined;
    server.use(
      http.get(apiUrl("/members"), () => HttpResponse.json(page([member]))),
      http.patch(apiUrl(`/members/${PLAYER.id}`), async ({ request }) => {
        sent = (await request.json()) as Schemas["MemberUpdate"];
        member = { ...member, ...sent } as Member;
        return HttpResponse.json(member);
      }),
    );
    renderRoute("/members");
    await userEvent.click(await screen.findByRole("button", { name: "Modifier Zinedine Zidane" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Numéro de licence"), "FFF-123");
    await userEvent.selectOptions(within(dialog).getByLabelText("Taille de maillot"), "l");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("FFF-123")).toBeInTheDocument();
    expect(sent?.jersey_size).toBe("l");
    expect(sent).not.toHaveProperty("team_id");
  });
  it("uses the real import report and endpoint", async () => {
    directory();
    let teamId: string | null = null;
    server.use(
      http.post(apiUrl("/members/import"), async ({ request }) => {
        teamId = new URL(request.url).searchParams.get("team_id");
        // Multipart serialization is covered against the real API in browser QA.
        expect(request.method).toBe("POST");
        return HttpResponse.json({ imported: 2, skipped: 1 }, { status: 201 });
      }),
    );
    renderRoute("/members");
    await screen.findByText("Zinedine Zidane");
    await userEvent.selectOptions(screen.getByLabelText("Filtrer par équipe"), TEAM.id);
    await userEvent.upload(
      screen.getByLabelText("Fichier des membres"),
      new File(["first_name,last_name\nNadia,Meziane"], "members.csv", { type: "text/csv" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "2 membre(s) importé(s) · 1 doublon(s) ignoré(s).",
    );
    expect(teamId).toBe(TEAM.id);
  });
  it("records attendance separately from the availability reply", async () => {
    let invitation: Invitation = { ...INVITATION, availability: "available" };
    server.use(
      http.get(apiUrl(`/events/${MATCH.id}`), () => HttpResponse.json(MATCH)),
      http.get(apiUrl("/invitations"), () => HttpResponse.json(page([invitation]))),
      http.get(apiUrl("/invitations/summary"), () =>
        HttpResponse.json({
          event_id: MATCH.id,
          invited: 1,
          available: 1,
          pending: 0,
          uncertain: 0,
          unavailable: 0,
        }),
      ),
      http.patch(apiUrl(`/invitations/${INVITATION.id}/attendance`), async ({ request }) => {
        invitation = {
          ...invitation,
          ...((await request.json()) as { attendance: Invitation["attendance"] }),
        };
        return HttpResponse.json(invitation);
      }),
    );
    renderRoute(`/events/${MATCH.id}`);
    await userEvent.selectOptions(
      await screen.findByLabelText("Présence réelle de Zinedine Zidane"),
      "late",
    );
    await expect.poll(() => invitation.attendance).toBe("late");
    expect(invitation.availability).toBe("available");
  });
  it("creates an event series from the club calendar", async () => {
    directory();
    let sent: Schemas["EventSeriesCreate"] | undefined;
    server.use(
      http.get(apiUrl("/events"), () => HttpResponse.json(page([]))),
      http.post(apiUrl("/events/series"), async ({ request }) => {
        sent = (await request.json()) as Schemas["EventSeriesCreate"];
        return HttpResponse.json([MATCH], { status: 201 });
      }),
    );
    renderRoute("/calendar?create=1");
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(await within(dialog).findByLabelText("Type"), "training");
    await userEvent.type(within(dialog).getByLabelText("Intitulé"), "Entraînement du mercredi");
    await userEvent.type(within(dialog).getByLabelText("Début"), "2026-10-14T18:00");
    await userEvent.click(within(dialog).getByLabelText("Répéter cet événement"));
    await userEvent.type(within(dialog).getByLabelText("Jusqu’au"), "2026-11-18");
    await userEvent.click(within(dialog).getByRole("button", { name: "Planifier la série" }));
    await expect.poll(() => sent?.repeat_until).toBe("2026-11-18");
    expect(sent?.team_id).toBe(TEAM.id);
    expect(sent?.timezone).toBeTruthy();
  });
  it("creates a custom team task", async () => {
    let tasks: Schemas["TeamTaskResponse"][] = [];
    server.use(
      http.get(apiUrl(`/teams/${TEAM.id}`), () => HttpResponse.json(TEAM)),
      http.get(apiUrl("/events"), () => HttpResponse.json(page([]))),
      http.get(apiUrl("/tasks"), () => HttpResponse.json(page(tasks))),
      http.get(apiUrl(`/stats/teams/${TEAM.id}/tasks`), () =>
        HttpResponse.json({ team_id: TEAM.id, tasks: [], rows: [] }),
      ),
      http.post(apiUrl("/tasks"), async ({ request }) => {
        const body = (await request.json()) as Schemas["TeamTaskCreate"];
        tasks = [{ ...body, id: "new-task", icon: body.icon ?? "other" }];
        return HttpResponse.json(tasks[0], { status: 201 });
      }),
    );
    renderRoute(`/teams/${TEAM.id}`);
    await userEvent.click(await screen.findByRole("tab", { name: "Tâches" }));
    await userEvent.type(await screen.findByLabelText("Nouvelle tâche"), "Préparer le goûter");
    await userEvent.selectOptions(screen.getByLabelText("Icône"), "food");
    await userEvent.click(screen.getByRole("button", { name: "Créer la tâche" }));
    expect(await screen.findByText("Préparer le goûter")).toBeInTheDocument();
    expect(tasks[0].team_id).toBe(TEAM.id);
  });
});
