import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Event, Invitation, LineupWrite, MatchFactCreate } from "@/api/client";
import { apiUrl, FORMATIONS, INVITATION, MATCH, page, PLAYER, server } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

const SUMMARY = {
  event_id: MATCH.id,
  invited: 1,
  pending: 0,
  available: 1,
  uncertain: 0,
  unavailable: 0,
};

function mockEvent(invitations: Invitation[], event: Event = MATCH) {
  server.use(
    http.get(apiUrl(`/events/${MATCH.id}`), () => HttpResponse.json(event)),
    http.get(apiUrl("/invitations"), () => HttpResponse.json(page(invitations))),
    http.get(apiUrl("/invitations/summary"), () =>
      HttpResponse.json({ ...SUMMARY, invited: invitations.length }),
    ),
    http.get(apiUrl("/members"), () => HttpResponse.json(page([PLAYER]))),
    http.get(apiUrl("/lineups/formations"), () => HttpResponse.json(FORMATIONS)),
    http.get(apiUrl(`/lineups/${MATCH.id}`), () =>
      HttpResponse.json({ code: "lineup_not_found", message: "none", errors: [] }, { status: 404 }),
    ),
    http.get(apiUrl("/match-facts"), () => HttpResponse.json(page([]))),
  );
}

describe("EventPage", () => {
  it("shows the match details and empty invitations", async () => {
    mockEvent([]);

    renderRoute(`/events/${MATCH.id}`);

    expect(await screen.findByRole("heading", { name: /Championnat J1/ })).toBeInTheDocument();
    expect(screen.getByText("Stade municipal")).toBeInTheDocument();
    expect(await screen.findByText(/personne n'est encore convoqué/i)).toBeInTheDocument();
  });

  it("invites the whole roster", async () => {
    let invitations: Invitation[] = [];
    mockEvent(invitations);
    server.use(
      http.get(apiUrl("/invitations"), () => HttpResponse.json(page(invitations))),
      http.post(apiUrl("/invitations"), () => {
        invitations = [INVITATION];
        return HttpResponse.json(invitations, { status: 201 });
      }),
    );
    renderRoute(`/events/${MATCH.id}`);

    await userEvent.click(await screen.findByRole("button", { name: "Convoquer tout l'effectif" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmer" }),
    );

    expect(await screen.findByText("Zinedine Zidane")).toBeInTheDocument();
    expect(screen.getByText("Sans réponse")).toBeInTheDocument();
  });

  it("reminds members who have not answered", async () => {
    mockEvent([INVITATION]);
    server.use(
      http.post(apiUrl("/invitations/reminders"), () =>
        HttpResponse.json({ event_id: MATCH.id, reminded: 1 }),
      ),
    );
    renderRoute(`/events/${MATCH.id}`);

    await userEvent.click(
      await screen.findByRole("button", { name: "Relancer les non-répondants" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmer" }),
    );

    expect(await screen.findByText("1 membre(s) relancé(s)")).toBeInTheDocument();
  });

  it("records a player's availability", async () => {
    let invitation = INVITATION;
    mockEvent([invitation]);
    server.use(
      http.get(apiUrl("/invitations"), () => HttpResponse.json(page([invitation]))),
      http.patch(apiUrl(`/invitations/${INVITATION.id}`), async ({ request }) => {
        const body = (await request.json()) as Pick<Invitation, "availability">;
        invitation = { ...invitation, availability: body.availability };
        return HttpResponse.json(invitation);
      }),
    );
    renderRoute(`/events/${MATCH.id}`);
    const group = await screen.findByRole("group", { name: "Réponse de Zinedine Zidane" });

    await userEvent.click(within(group).getByRole("button", { name: "Présent" }));

    expect(await within(group).findByRole("button", { pressed: true })).toHaveTextContent(
      "Présent",
    );
  });

  it("places a player on the pitch and saves the lineup", async () => {
    let sent: LineupWrite | undefined;
    mockEvent([]);
    server.use(
      http.put(apiUrl(`/lineups/${MATCH.id}`), async ({ request }) => {
        sent = (await request.json()) as LineupWrite;
        return HttpResponse.json({
          id: "lineup-1",
          event_id: MATCH.id,
          formation: sent.formation,
          is_published: sent.is_published,
          slots: [],
          updated_at: "2026-10-05T10:00:00Z",
          unavailable_member_ids: [PLAYER.id],
        });
      }),
    );
    renderRoute(`/events/${MATCH.id}`);
    await userEvent.click(await screen.findByRole("tab", { name: "Composition" }));

    await userEvent.click(await screen.findByRole("button", { name: /Zinedine Zidane/ }));
    await userEvent.click(screen.getByRole("button", { name: "Poste 1 libre" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Composition enregistrée");
    expect(sent?.slots).toEqual([{ member_id: PLAYER.id, role: "starter", position_index: 0 }]);
  });

  it("records a goal in the match tab", async () => {
    let sent: MatchFactCreate | undefined;
    mockEvent([]);
    server.use(
      http.post(apiUrl("/match-facts"), async ({ request }) => {
        sent = (await request.json()) as MatchFactCreate;
        return HttpResponse.json({ id: "fact-1" }, { status: 201 });
      }),
    );
    renderRoute(`/events/${MATCH.id}`);
    await userEvent.click(await screen.findByRole("tab", { name: "Match" }));

    const form = await screen.findByRole("form", { name: "Faits de match" });
    await userEvent.type(within(form).getByLabelText("Minute"), "17");
    await userEvent.click(within(form).getByRole("button", { name: "Ajouter" }));

    await expect
      .poll(() => sent)
      .toEqual({
        event_id: MATCH.id,
        kind: "goal",
        member_id: PLAYER.id,
        assist_member_id: null,
        minute: 17,
      });
  });

  it("hides lineup and match tabs for a training", async () => {
    mockEvent([], { ...MATCH, kind: "training", opponent: null, venue: null });

    renderRoute(`/events/${MATCH.id}`);

    expect(await screen.findByRole("tab", { name: "Convocations" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Composition" })).not.toBeInTheDocument();
  });
});
