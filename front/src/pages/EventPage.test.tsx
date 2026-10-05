import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Invitation } from "@/api/client";
import { apiUrl, INVITATION, MATCH, page, server } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

const SUMMARY = {
  event_id: MATCH.id,
  invited: 1,
  pending: 0,
  available: 1,
  uncertain: 0,
  unavailable: 0,
};

function mockEvent(invitations: Invitation[]) {
  server.use(
    http.get(apiUrl(`/events/${MATCH.id}`), () => HttpResponse.json(MATCH)),
    http.get(apiUrl("/invitations"), () => HttpResponse.json(page(invitations))),
    http.get(apiUrl("/invitations/summary"), () =>
      HttpResponse.json({ ...SUMMARY, invited: invitations.length }),
    ),
  );
}

describe("EventPage", () => {
  it("shows the match details", async () => {
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

    expect(await screen.findByText("Zinedine Zidane")).toBeInTheDocument();
    expect(screen.getByText("Sans réponse")).toBeInTheDocument();
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
});
