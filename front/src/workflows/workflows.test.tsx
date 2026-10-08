import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ROUTES } from "@/routes";
import { initialState } from "@/server/state";
import { createCoreAPI } from "@/server/core-api";
import { applyAction } from "./engine";
import type { FileRecord, WorkspaceState } from "./types";
let state: WorkspaceState, files: FileRecord[], original: typeof fetch;
beforeEach(() => {
  state = initialState();
  files = [];
  original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), "http://localhost"), init);
    const path = new URL(request.url).pathname;
    if (path === "/api/v2/workspace")
      return Response.json({
        ...state,
        files,
        revision: 1,
        user: { name: "Coach" },
        serverTime: new Date().toISOString(),
      });
    if (path === "/api/v2/actions") {
      try {
        const { type, payload } = await request.json();
        return Response.json(applyAction(state, type, payload, "Coach", files));
      } catch (error) {
        return Response.json({ message: (error as Error).message }, { status: 422 });
      }
    }
    if (path === "/api/v2/files" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file") as File;
      const result: FileRecord = {
        id: crypto.randomUUID(),
        rootId: "test",
        version: 1,
        name: file.name,
        mime: file.type,
        size: file.size,
        entityType: String(form.get("entityType")),
        entityId: String(form.get("entityId")),
        category: "other",
        status: "pending",
        expiresAt: null,
        note: "",
        createdAt: new Date().toISOString(),
        url: "/api/v2/files/test",
      };
      files.push(result);
      return Response.json(result, { status: 201 });
    }
    return createCoreAPI(state.core).fetch(request);
  };
});
afterEach(() => {
  globalThis.fetch = original;
});
function open(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(ROUTES, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
it("renders every new module and detail route from server state", async () => {
  const router = open("/campaigns");
  const routes = [
    ["/campaigns", "Campagnes & envois"],
    ["/campaigns/campaign-season", "Informations de rentrée"],
    ["/messaging", "Messagerie"],
    ["/payments", "Paiements & cotisations"],
    ["/payments/collection-season", "Cotisation saison 2026–2027"],
    ["/sponsors", "Sponsors & partenaires"],
    ["/sponsors/sponsor-cycle", "Atelier du Cycle"],
    ["/tasks", "Tâches & responsabilités"],
    ["/documents", "Documents & médias"],
    ["/users", "Utilisateurs"],
    [
      "/users/" + state.core.members[0].id,
      state.core.members[0].first_name + " " + state.core.members[0].last_name,
    ],
    [
      "/members/" + state.core.members[0].id,
      state.core.members[0].first_name + " " + state.core.members[0].last_name,
    ],
    ["/competitions", "Championnats"],
    ["/invitations", "Convocations"],
    ["/statistics", "Statistiques du club"],
    ["/settings", "Réglages & activité"],
  ];
  for (const [path, title] of routes) {
    await act(async () => {
      await router.navigate(path);
    });
    await waitFor(() => expect(document.querySelector("h1")?.textContent).toContain(title));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }
});
it("completes the campaign wizard and opens recipient tracking", async () => {
  open("/campaigns");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Créer une campagne" }));
  await user.type(screen.getByLabelText(/Nom de la campagne/), "Tournoi du printemps");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(screen.getByRole("button", { name: "Sélectionner la liste" }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.type(screen.getByLabelText(/Objet de l’email/), "Invitation au tournoi");
  await user.type(screen.getByLabelText(/^Message/), "Bienvenue au tournoi du club.");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.selectOptions(screen.getByLabelText("Suite du parcours"), "now");
  await user.click(screen.getByRole("button", { name: "Lancer la simulation" }));
  await screen.findByRole("heading", { name: "Tournoi du printemps" });
  expect(state.flow.campaigns.find((c) => c.name === "Tournoi du printemps")?.status).toBe(
    "running",
  );
  expect(state.flow.deliveries).toHaveLength(state.core.members.length);
  expect(
    await screen.findByRole("heading", { name: "Journal de distribution" }),
  ).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Détail" })[0]);
  expect(screen.getByRole("dialog")).toHaveTextContent("Mise en file");
});
it("shows an error without losing a draft or navigating away", async () => {
  open("/campaigns");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Créer une campagne" }));
  await user.type(screen.getByLabelText(/Nom de la campagne/), "Dossier conservé");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.selectOptions(screen.getByLabelText("Suite du parcours"), "now");
  await user.click(screen.getByRole("button", { name: "Lancer la simulation" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Complétez");
  await user.click(screen.getByRole("button", { name: /1Préparer|1 Préparer/ }));
  expect(screen.getByLabelText(/Nom de la campagne/)).toHaveValue("Dossier conservé");
  expect(state.flow.campaigns.some((c) => c.name === "Dossier conservé")).toBe(false);
});
it("opens a collection, displays its installments and prevents accidental closure", async () => {
  open("/payments/collection-season");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Ouvrir la collecte/ }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Confirmer" }));
  await waitFor(() => expect(state.flow.charges.length).toBeGreaterThan(0));
  expect(state.flow.collections[0].status).toBe("open");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("table")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clôturer" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retour" }));
  expect(state.flow.collections[0].status).toBe("open");
});
it("publishes a message in the selected discussion", async () => {
  open("/messaging");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Organisation du week-end/ }));
  const composer = screen.getByLabelText(/message/i);
  await user.type(composer, "Rendez-vous au stade à 14 h.");
  await user.click(screen.getByRole("button", { name: /Publier le message/ }));
  expect(
    await screen.findByText("Rendez-vous au stade à 14 h.", { selector: "p" }),
  ).toBeInTheDocument();
  expect(state.flow.conversations[0].messages).toHaveLength(2);
});
it("creates nested folders and opens their breadcrumbs", async () => {
  open("/documents");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouveau dossier" }));
  await user.type(screen.getByLabelText(/Nom du dossier/), "Saison 2026");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enregistrer" }));
  await screen.findByRole("button", { name: "Nouveau sous-dossier" });
  await user.click(screen.getByRole("button", { name: "Nouveau sous-dossier" }));
  await user.type(screen.getByLabelText(/Nom du dossier/), "Licences");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(state.flow.folders).toHaveLength(2));
  expect(state.flow.folders[1].parentId).toBe(state.flow.folders[0].id);
  await screen.findByRole("navigation", { name: "Chemin du dossier" });
  expect(screen.getByRole("navigation", { name: "Chemin du dossier" })).toHaveTextContent(
    "Saison 2026Licences",
  );
});
it("adds a member from the users page and refreshes the filtered directory", async () => {
  open("/users");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter un membre" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText(/Prénom/), "Zoé");
  await user.type(within(dialog).getByLabelText(/^Nom/), "Martin");
  await user.click(within(dialog).getByRole("button", { name: /Ajouter/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.type(screen.getByPlaceholderText("Nom, email ou numéro de licence"), "Zoé Martin");
  expect(await screen.findByRole("link", { name: "Zoé Martin" })).toBeInTheDocument();
});
it("opens a member's task filter and tracks a confirmed licence reminder", async () => {
  const member = state.core.members[0];
  const router = open(`/tasks?memberId=${member.id}`);
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByLabelText("Membre responsable")).toHaveValue(member.id));
  await act(async () => {
    await router.navigate(`/users/${member.id}`);
  });
  await user.click(await screen.findByRole("button", { name: "Relancer la licence" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmer" }));
  expect(
    await screen.findByRole("link", { name: "Voir le suivi de cette relance" }),
  ).toBeInTheDocument();
  expect(state.flow.campaigns[0]).toMatchObject({ kind: "reminder", memberIds: [member.id] });
});
