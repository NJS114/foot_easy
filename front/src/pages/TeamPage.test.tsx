import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiUrl, MATCH, page, PLAYER, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

const STATS = {
  team_id: TEAM.id,
  played: 4,
  wins: 2,
  draws: 1,
  losses: 1,
  goals_for: 7,
  goals_against: 5,
  players: [
    {
      member: { ...PLAYER },
      selections: 3,
      goals: 4,
      assists: 2,
      yellow_cards: 1,
      red_cards: 0,
      invited: 4,
      present: 3,
      attendance_rate: 0.75,
    },
  ],
};

function mockTeam(members = [PLAYER], events = [MATCH]) {
  server.use(
    http.get(apiUrl(`/teams/${TEAM.id}`), () => HttpResponse.json(TEAM)),
    http.get(apiUrl("/members"), () => HttpResponse.json(page(members))),
    http.get(apiUrl("/events"), () => HttpResponse.json(page(events))),
    http.get(apiUrl(`/stats/teams/${TEAM.id}`), () => HttpResponse.json(STATS)),
  );
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole("tab", { name }));
}

describe("TeamPage", () => {
  it("shows the team events by default", async () => {
    mockTeam();

    renderRoute(`/teams/${TEAM.id}`);

    expect(await screen.findByText("Championnat J1")).toBeInTheDocument();
    expect(screen.getByText("contre AS Rivale")).toBeInTheDocument();
  });

  it("shows the roster in its tab", async () => {
    mockTeam();
    renderRoute(`/teams/${TEAM.id}`);

    await openTab("Effectif");

    const row = (await screen.findByText("Zinedine Zidane")).closest("li")!;
    expect(within(row).getByText("Milieu")).toBeInTheDocument();
  });

  it("shows the empty states for a new team", async () => {
    mockTeam([], []);
    renderRoute(`/teams/${TEAM.id}`);

    expect(await screen.findByText(/aucun événement/i)).toBeInTheDocument();
    await openTab("Effectif");
    expect(await screen.findByText(/aucun membre/i)).toBeInTheDocument();
  });

  it("shows the conflict message when the shirt number is taken", async () => {
    mockTeam();
    server.use(
      http.post(apiUrl("/members"), () =>
        HttpResponse.json(
          { code: "shirt_number_taken", message: "Shirt number 10 is already taken", errors: [] },
          { status: 409 },
        ),
      ),
    );
    renderRoute(`/teams/${TEAM.id}`);
    await openTab("Effectif");
    const form = await screen.findByRole("form", { name: "Nouveau membre" });

    await userEvent.type(within(form).getByLabelText("Prénom"), "Karim");
    await userEvent.type(within(form).getByLabelText("Nom"), "Benzema");
    await userEvent.type(within(form).getByLabelText("N° de maillot"), "10");
    await userEvent.click(within(form).getByRole("button", { name: "Ajouter au groupe" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("already taken");
  });

  it("shows the season record and player statistics", async () => {
    mockTeam();
    renderRoute(`/teams/${TEAM.id}`);

    await openTab("Statistiques");

    const victories = (await screen.findByText("Victoires")).parentElement!;
    expect(within(victories).getByText("2")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Zinedine Zidane/ });
    expect(within(row).getByText("75 %")).toBeInTheDocument();
  });
});
