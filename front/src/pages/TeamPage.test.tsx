import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiUrl, MATCH, page, PLAYER, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

function mockTeam(members = [PLAYER], events = [MATCH]) {
  server.use(
    http.get(apiUrl(`/teams/${TEAM.id}`), () => HttpResponse.json(TEAM)),
    http.get(apiUrl("/members"), () => HttpResponse.json(page(members))),
    http.get(apiUrl("/events"), () => HttpResponse.json(page(events))),
  );
}

describe("TeamPage", () => {
  it("shows the roster and the upcoming events", async () => {
    mockTeam();

    renderRoute(`/teams/${TEAM.id}`);

    const row = (await screen.findByText("Zinedine Zidane")).closest("li")!;
    expect(within(row).getByText("Milieu")).toBeInTheDocument();
    expect(await screen.findByText("Championnat J1")).toBeInTheDocument();
    expect(screen.getByText("contre AS Rivale")).toBeInTheDocument();
  });

  it("shows the empty states for a new team", async () => {
    mockTeam([], []);

    renderRoute(`/teams/${TEAM.id}`);

    expect(await screen.findByText(/aucun membre/i)).toBeInTheDocument();
    expect(await screen.findByText(/aucun événement/i)).toBeInTheDocument();
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
    const form = await screen.findByRole("form", { name: "Nouveau membre" });

    await userEvent.type(within(form).getByLabelText("Prénom"), "Karim");
    await userEvent.type(within(form).getByLabelText("Nom"), "Benzema");
    await userEvent.type(within(form).getByLabelText("N° de maillot"), "10");
    await userEvent.click(within(form).getByRole("button", { name: "Ajouter au groupe" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("already taken");
  });

  it("hides the position fields for a coach", async () => {
    mockTeam();
    renderRoute(`/teams/${TEAM.id}`);
    const form = await screen.findByRole("form", { name: "Nouveau membre" });

    await userEvent.selectOptions(within(form).getByLabelText("Rôle"), "coach");

    expect(within(form).queryByLabelText("Poste")).not.toBeInTheDocument();
  });
});
