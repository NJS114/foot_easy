import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TwilioTest } from "./TwilioTest";
let original: typeof fetch;
beforeEach(() => {
  original = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = original;
});
function open() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <TwilioTest />
    </QueryClientProvider>,
  );
}
it("requires confirmation before sending and displays Twilio's delivered status", async () => {
  const sid = "SM" + "a".repeat(32),
    record = {
      id: "test-local-123",
      sid,
      to: "+33600000000",
      status: "queued",
      detail: "Pris en charge",
      errorCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  const send = vi.fn();
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path.endsWith("/twilio"))
      return Response.json({
        local: true,
        enabled: true,
        ready: true,
        missing: [],
        sender: "+15005550006",
        to: record.to,
        authMode: "Account SID / Auth Token",
        lastTest: null,
      });
    if (init?.method === "POST") {
      send(JSON.parse(String(init.body)));
      return Response.json(record, { status: 201 });
    }
    return Response.json({ ...record, status: "delivered", detail: "Statut fourni par Twilio." });
  };
  open();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Envoyer un SMS réel de test" }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent(record.to);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmer" }));
  await waitFor(() => expect(send).toHaveBeenCalledOnce());
  expect(send).toHaveBeenCalledWith({
    to: record.to,
    body: "Foot Easy : test SMS local.",
    confirm: true,
  });
  expect(await screen.findByText("Dernier test : Distribué")).toBeInTheDocument();
});
it("shows setup requirements without enabling an incomplete configuration", async () => {
  globalThis.fetch = async () =>
    Response.json({
      local: true,
      enabled: false,
      ready: false,
      missing: ["TWILIO_AUTH_TOKEN"],
      sender: "",
      to: "",
      authMode: "Account SID / Auth Token",
      lastTest: null,
    });
  open();
  expect(await screen.findByText("Configuration à compléter")).toBeInTheDocument();
  expect(screen.getByText(/Champs manquants/)).toHaveTextContent("TWILIO_AUTH_TOKEN");
  expect(
    screen.queryByRole("button", { name: "Envoyer un SMS réel de test" }),
  ).not.toBeInTheDocument();
});
