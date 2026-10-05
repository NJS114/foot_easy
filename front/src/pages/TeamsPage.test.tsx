import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiUrl, page, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

describe("TeamsPage", () => {
  it("lists the teams with their category", async () => {
    server.use(http.get(apiUrl("/teams"), () => HttpResponse.json(page([TEAM]))));

    renderRoute("/");

    const card = (await screen.findByText("FC Easy")).closest("li")!;
    expect(within(card).getByText("Seniors")).toBeInTheDocument();
  });

  it("shows the empty state when there is no team", async () => {
    server.use(http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))));

    renderRoute("/");

    expect(await screen.findByText(/aucune équipe/i)).toBeInTheDocument();
  });

  it("shows the API error message when loading fails", async () => {
    server.use(
      http.get(apiUrl("/teams"), () =>
        HttpResponse.json({ code: "internal_error", message: "Boom", errors: [] }, { status: 500 }),
      ),
    );

    renderRoute("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
  });

  it("creates a team and refreshes the list", async () => {
    let teams = [] as (typeof TEAM)[];
    server.use(
      http.get(apiUrl("/teams"), () => HttpResponse.json(page(teams))),
      http.post(apiUrl("/teams"), async ({ request }) => {
        const body = (await request.json()) as typeof TEAM;
        teams = [{ ...TEAM, ...body }];
        return HttpResponse.json(teams[0], { status: 201 });
      }),
    );
    renderRoute("/");

    await userEvent.type(await screen.findByLabelText("Nom de l'équipe"), "U13 A");
    await userEvent.type(screen.getByLabelText("Saison"), "2026-2027");
    await userEvent.click(screen.getByRole("button", { name: "Créer l'équipe" }));

    expect(await screen.findByText("U13 A")).toBeInTheDocument();
  });

  it("maps a validation error onto the season field", async () => {
    server.use(
      http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))),
      http.post(apiUrl("/teams"), () =>
        HttpResponse.json(
          {
            code: "validation_error",
            message: "Invalid request",
            errors: [{ field: "season", message: "Format invalide" }],
          },
          { status: 422 },
        ),
      ),
    );
    renderRoute("/");

    await userEvent.type(await screen.findByLabelText("Nom de l'équipe"), "U13 A");
    await userEvent.type(screen.getByLabelText("Saison"), "2026");
    await userEvent.click(screen.getByRole("button", { name: "Créer l'équipe" }));

    expect(await screen.findByText("Format invalide")).toBeInTheDocument();
    expect(screen.getByLabelText("Saison")).toHaveAttribute("aria-invalid", "true");
  });
});
