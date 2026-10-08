import worker from "./index.ts";
import { createEnvironment } from "./test/runtime.mjs";

const account = "AC" + "a".repeat(32),
  sid = "SM" + "b".repeat(32),
  key = "SK" + "c".repeat(32);
let runtime, upstream;
beforeEach(() => {
  runtime = createEnvironment();
  Object.assign(runtime.env, {
    LOCAL_DEVELOPMENT: "true",
    TWILIO_TEST_ENABLED: "true",
    TWILIO_ACCOUNT_SID: account,
    TWILIO_AUTH_TOKEN: "secret-token",
    TWILIO_FROM_NUMBER: "+15005550006",
    TWILIO_TEST_TO: "+33600000000",
  });
  upstream = vi.fn(async () => Response.json({ sid, status: "queued", error_code: null }));
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => {
  runtime.close();
  vi.unstubAllGlobals();
});
function call(path = "", method = "GET", body, options = {}) {
  return worker.fetch(
    new Request((options.origin || "http://localhost:5173") + "/api/v2/providers/twilio" + path, {
      method,
      headers: {
        "oai-authenticated-user-id": options.owner || "local",
        "x-request-id": options.id || crypto.randomUUID(),
        "content-type": "application/json",
        ...(options.headers || {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    runtime.env,
  );
}
const payload = { to: "+33600000000", body: "Test du club", confirm: true };
it("only exposes nonsecret configuration and blocks nonlocal or disabled real sends", async () => {
  const config = await (await call()).text();
  expect(config).toContain('"ready":true');
  expect(config).not.toContain("secret-token");
  expect(config).not.toContain(account);
  expect(
    (
      await call("/test", "POST", payload, {
        origin: "https://evil.example",
        headers: { Origin: "https://evil.example" },
      })
    ).status,
  ).toBe(403);
  runtime.env.TWILIO_TEST_ENABLED = "false";
  expect((await call("/test", "POST", payload)).status).toBe(403);
  delete runtime.env.LOCAL_DEVELOPMENT;
  expect(await (await call()).json()).toEqual({ local: false });
  expect((await call("/test", "POST", payload)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
});
it("validates the pinned destination, confirmation and credentials before any provider call", async () => {
  expect((await call("/test", "POST", { ...payload, to: "+33700000000" })).status).toBe(403);
  expect((await call("/test", "POST", { ...payload, confirm: false })).status).toBe(422);
  expect((await call("/test", "POST", { ...payload, body: "" })).status).toBe(422);
  runtime.env.TWILIO_AUTH_TOKEN = "";
  expect((await call("/test", "POST", payload)).status).toBe(422);
  expect(upstream).not.toHaveBeenCalled();
});
it("sends once using Twilio's API, preserves the test on reload and reads actual delivery status", async () => {
  const id = crypto.randomUUID();
  const first = await call("/test", "POST", payload, { id });
  expect(first.status).toBe(201);
  const record = await first.json();
  expect(record).toMatchObject({ id, sid, status: "queued", to: payload.to });
  const [url, request] = upstream.mock.calls[0];
  expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`);
  expect(atob(request.headers.Authorization.slice(6))).toBe(account + ":secret-token");
  expect(Object.fromEntries(request.body)).toEqual({
    To: payload.to,
    Body: payload.body,
    From: "+15005550006",
  });
  expect((await call("/test", "POST", payload, { id })).status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect((await call("/test", "POST", { ...payload, body: "Autre" }, { id })).status).toBe(409);
  expect((await call("/test", "POST", payload)).status).toBe(429);
  expect((await (await call()).json()).lastTest.sid).toBe(sid);
  expect((await call(`/test/${id}`, "GET", undefined, { owner: "other" })).status).toBe(404);
  upstream.mockResolvedValueOnce(Response.json({ sid, status: "delivered", error_code: null }));
  expect((await (await call(`/test/${id}`)).json()).status).toBe("delivered");
  expect(upstream.mock.calls[1][1].method).toBe("GET");
  expect(upstream).toHaveBeenCalledTimes(2);
});
it("supports API keys and Messaging Services without leaking credentials in errors", async () => {
  Object.assign(runtime.env, {
    TWILIO_API_KEY_SID: key,
    TWILIO_API_KEY_SECRET: "key-secret",
    TWILIO_FROM_NUMBER: "",
    TWILIO_MESSAGING_SERVICE_SID: "MG" + "d".repeat(32),
  });
  upstream.mockResolvedValueOnce(
    Response.json(
      { code: 21608, message: "secret-token key-secret upstream text" },
      { status: 400 },
    ),
  );
  const response = await call("/test", "POST", payload);
  expect(response.status).toBe(422);
  const text = await response.text();
  expect(text).toContain("Compte d’essai");
  expect(text).not.toContain("secret-token");
  expect(text).not.toContain("key-secret");
  const request = upstream.mock.calls[0][1];
  expect(atob(request.headers.Authorization.slice(6))).toBe(key + ":key-secret");
  expect(request.body.get("MessagingServiceSid")).toBe("MG" + "d".repeat(32));
  expect(request.body.has("From")).toBe(false);
});
it("never retries an uncertain provider result and reports that it needs checking in Twilio", async () => {
  upstream.mockRejectedValue(new Error("timeout secret-token"));
  const id = crypto.randomUUID();
  const response = await call("/test", "POST", payload, { id });
  expect(response.status).toBe(502);
  expect(await response.text()).toContain("Aucun renvoi automatique");
  expect((await call("/test", "POST", payload, { id })).status).toBe(502);
  expect(upstream).toHaveBeenCalledTimes(1);
  const record = (await (await call()).json()).lastTest;
  expect(record.status).toBe("unknown");
  expect(JSON.stringify(record)).not.toContain("secret-token");
});
it("claims concurrent sends atomically so a double click creates only one message", async () => {
  let release;
  upstream.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const id = crypto.randomUUID(),
    first = call("/test", "POST", payload, { id });
  await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
  expect((await call("/test", "POST", payload, { id })).status).toBe(409);
  expect((await call("/test", "POST", payload)).status).toBe(429);
  release(Response.json({ sid, status: "queued" }));
  expect((await first).status).toBe(201);
  expect(upstream).toHaveBeenCalledTimes(1);
});
