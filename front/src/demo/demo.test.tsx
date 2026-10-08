import { File as NodeFile } from "node:buffer";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { router } from "@/App";
import "@/i18n";
import { createCoreAPI } from "@/server/core-api";
import { initialState } from "@/server/state";
const state = initialState();
const demoFetch = createCoreAPI(state.core).fetch;
function installDemoTransport() {
  globalThis.fetch = async (input, init) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), "http://localhost"), init);
    if (new URL(request.url).pathname === "/api/v2/workspace")
      return new Response(
        JSON.stringify({
          ...state,
          files: [],
          revision: 1,
          user: { name: "Coach" },
          serverTime: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    return demoFetch(request);
  };
}

const request = (path: string, method = "GET", body?: unknown) =>
  demoFetch(
    new Request(`http://localhost/api/v1${path}`, {
      method,
      ...(body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    }),
  );

const browserFile = globalThis.File;
beforeAll(() => {
  globalThis.File = NodeFile as unknown as typeof File;
});
afterAll(() => {
  globalThis.File = browserFile;
});
afterEach(cleanup);

it("renders the actual application routes and team reports with demo data", async () => {
  const original = globalThis.fetch;
  installDemoTransport();
  try {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Bienvenue/i })).toBeInTheDocument();
    for (const [path, title] of [
      ["/calendar", "Calendrier du club"],
      ["/members", "Annuaire des membres"],
      ["/teams", "Gestion sportive"],
    ]) {
      await act(async () => {
        await router.navigate(path);
      });
      await waitFor(() => expect(document.querySelector("h1")?.textContent).toContain(title));
    }
    await act(async () => {
      await router.navigate("/teams/seniors-a");
    });
    expect(await screen.findByRole("heading", { name: "Seniors A" })).toBeInTheDocument();
    const user = userEvent.setup();
    for (const name of ["Présences", "Tâches", "Statistiques"]) {
      await user.click(screen.getByRole("tab", { name }));
      await waitFor(() => expect(screen.queryByText("Chargement…")).not.toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
    await act(async () => {
      await router.navigate("/events/seniors-a-match-4");
    });
    expect(
      await screen.findByRole("heading", { name: /Championnat · Journée 5/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Composition/ }));
    expect(await screen.findByLabelText(/Schéma/)).toHaveValue("4-3-3");
  } finally {
    globalThis.fetch = original;
  }
});

it("keeps event, invitations, attendance, tasks and lineup changes in the same demo state", async () => {
  const event = await (
    await request("/events", "POST", {
      team_id: "seniors-a",
      kind: "match",
      title: "Match de test",
      starts_at: "2026-10-15T15:00:00Z",
    })
  ).json();
  expect(event.id).toBeTruthy();
  const invited = await (await request("/invitations", "POST", { event_id: event.id })).json();
  expect(invited.length).toBeGreaterThan(11);
  await request(`/invitations/${invited[0].id}`, "PATCH", { availability: "available" });
  await request(`/invitations/${invited[0].id}/attendance`, "PATCH", { attendance: "late" });
  const summary = await (await request(`/invitations/summary?event_id=${event.id}`)).json();
  expect(summary.available).toBe(1);
  const task = await (
    await request("/tasks", "POST", { team_id: "seniors-a", name: "Buvette test", icon: "food" })
  ).json();
  await request("/tasks/assignments", "POST", {
    event_id: event.id,
    team_task_id: task.id,
    member_id: invited[0].member.id,
  });
  expect(await (await request(`/tasks/assignments?event_id=${event.id}`)).json()).toHaveLength(1);
  const saved = await (
    await request(`/lineups/${event.id}`, "PUT", {
      formation: "4-4-2",
      is_published: false,
      slots: [{ member_id: invited[0].member.id, role: "starter", position_index: 0 }],
    })
  ).json();
  expect(saved.slots[0].member.id).toBe(invited[0].member.id);
  expect((await (await request(`/lineups/${event.id}`)).json()).formation).toBe("4-4-2");
  const invalid = await request("/events", "POST", {
    team_id: "seniors-a",
    kind: "training",
    title: "Invalid",
    starts_at: "2026-10-15T15:00:00Z",
    ends_at: "2026-10-15T14:00:00Z",
  });
  expect(invalid.status).toBe(422);
});

it("edits, filters, exports and imports demo members without a remote server", async () => {
  const member = await (
    await request("/members", "POST", {
      team_id: "seniors-a",
      first_name: "Test",
      last_name: "Aperçu",
    })
  ).json();
  await request(`/members/${member.id}`, "PATCH", { shirt_number: 98 });
  const results = await (await request("/members?search=apercu")).json();
  expect(results.items[0].shirt_number).toBe(98);
  const csv = await (await request("/members/export?search=apercu")).text();
  expect(csv).toContain("Aperçu");
  const response = await demoFetch(
    new Request("http://localhost/api/v1/members/import?team_id=seniors-a", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=foot-easy-test" },
      body: '--foot-easy-test\r\nContent-Disposition: form-data; name="file"; filename="roster.csv"\r\nContent-Type: text/csv\r\n\r\nPrénom;Nom\nEssai;Importé\r\n--foot-easy-test--\r\n',
    }),
  );
  expect(await response.json()).toMatchObject({ imported: 1, skipped: 0 });
});
