import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { TeamCreate } from "@/api/client";
import { apiUrl, CLUB, page, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

describe("TeamsPage", () => {
  it("lists the club teams with their category", async () => {
    server.use(
      http.get(apiUrl("/teams"), ({ request }) => {
        const clubId = new URL(request.url).searchParams.get("club_id");
        return HttpResponse.json(page(clubId === CLUB.id ? [TEAM] : []));
      }),
    );

    renderRoute("/teams");

    const card = (await screen.findByText("FC Easy")).closest("li")!;
    expect(within(card).getByText("Seniors")).toBeInTheDocument();
  });

  it("shows the empty state when there is no team", async () => {
    server.use(http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))));

    renderRoute("/teams");

    expect(await screen.findByText(/aucune équipe/i)).toBeInTheDocument();
  });

  it("shows the API error message when loading fails", async () => {
    server.use(
      http.get(apiUrl("/teams"), () =>
        HttpResponse.json({ code: "internal_error", message: "Boom", errors: [] }, { status: 500 }),
      ),
    );

    renderRoute("/teams");

    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
  });

  it("creates a team in the current club", async () => {
    let teams = [] as (typeof TEAM)[];
    let sent: TeamCreate | undefined;
    server.use(
      http.get(apiUrl("/teams"), () => HttpResponse.json(page(teams))),
      http.post(apiUrl("/teams"), async ({ request }) => {
        sent = (await request.json()) as TeamCreate;
        teams = [{ ...TEAM, ...sent }];
        return HttpResponse.json(teams[0], { status: 201 });
      }),
    );
    renderRoute("/teams");

    await userEvent.type(await screen.findByLabelText("Nom de l'équipe"), "U13 A");
    await userEvent.type(screen.getByLabelText("Saison"), "2026-2027");
    await userEvent.click(screen.getByRole("button", { name: "Créer l'équipe" }));

    expect(await screen.findByText("U13 A")).toBeInTheDocument();
    expect(sent?.club_id).toBe(CLUB.id);
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
    renderRoute("/teams");

    await userEvent.type(await screen.findByLabelText("Nom de l'équipe"), "U13 A");
    await userEvent.type(screen.getByLabelText("Saison"), "2026");
    await userEvent.click(screen.getByRole("button", { name: "Créer l'équipe" }));

    expect(await screen.findByText("Format invalide")).toBeInTheDocument();
    expect(screen.getByLabelText("Saison")).toHaveAttribute("aria-invalid", "true");
  });
});
