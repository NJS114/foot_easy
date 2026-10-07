import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Club, ClubCreate } from "@/api/client";
import { apiUrl, CLUB, MATCH, page, server, TEAM } from "@/test/server";
import { renderRoute } from "@/test/renderRoute";

const TRAINING = { ...MATCH, id: "event-2", kind: "training" as const, title: "Séance vitesse" };

describe("Club space", () => {
  it("asks to register a club when none exists, then opens the club space", async () => {
    let clubs: Club[] = [];
    let sent: ClubCreate | undefined;
    server.use(
      http.get(apiUrl("/clubs"), () => HttpResponse.json(page(clubs))),
      http.post(apiUrl("/clubs"), async ({ request }) => {
        sent = (await request.json()) as ClubCreate;
        clubs = [{ ...CLUB, name: sent.name }];
        return HttpResponse.json(clubs[0], { status: 201 });
      }),
      http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))),
    );
    renderRoute("/");

    await userEvent.type(await screen.findByLabelText("Nom du club"), "US Quartier");
    await userEvent.click(screen.getByRole("button", { name: "Créer mon club" }));

    expect(await screen.findByText("Bienvenue au US Quartier")).toBeInTheDocument();
    expect(sent?.name).toBe("US Quartier");
  });

  it("shows the sporting and administrative modules in the navigation", async () => {
    server.use(http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))));

    renderRoute("/");

    const nav = await screen.findByRole("navigation", { name: "Navigation du club" });
    expect(nav.querySelectorAll("a")).toHaveLength(15);
    expect(nav.querySelector('a[href="/users"]')).toHaveTextContent("Utilisateurs");
  });

  it("filters the club calendar by event type", async () => {
    server.use(
      http.get(apiUrl("/teams"), () => HttpResponse.json(page([TEAM]))),
      http.get(apiUrl("/events"), () => HttpResponse.json(page([MATCH, TRAINING]))),
    );
    renderRoute("/calendar");
    await userEvent.click(await screen.findByRole("button", { name: "Agenda" }));
    expect(await screen.findByText("Séance vitesse")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Type"), "match");

    expect(screen.queryByText("Séance vitesse")).not.toBeInTheDocument();
    expect(screen.getByText("Championnat J1")).toBeInTheDocument();
  });

  it("opens the payment workflow and its collection editor", async () => {
    server.use(http.get(apiUrl("/teams"), () => HttpResponse.json(page([]))));

    renderRoute("/payments");

    expect(
      await screen.findByRole("heading", { name: "Paiements & cotisations" }),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Créer une collecte" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Nouvelle collecte");
  });
});
