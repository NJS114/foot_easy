import worker from "./index.ts";
import { createEnvironment } from "./test/runtime.mjs";
import { tick, ranking, chargeStatus, paidAmount } from "../src/workflows/domain.ts";
import { applyAction } from "../src/workflows/engine.ts";
import { loadWorkspace, persist } from "./storage.ts";
import { initialState } from "../src/server/state.ts";
import { addLocalDays } from "../src/workflows/dates.ts";
let runtime;
beforeEach(() => {
  runtime = createEnvironment();
});
afterEach(() => runtime.close());
async function call(path = "/api/v2/workspace", method = "GET", body, options = {}) {
  const headers = new Headers({
    "oai-authenticated-user-id": options.owner || "owner-one",
    "oai-authenticated-user-full-name": "Coach",
    "X-Request-Id": options.id || crypto.randomUUID(),
    ...options.headers,
  });
  if (options.anonymous) headers.delete("oai-authenticated-user-id");
  let content = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("content-type", "application/json");
    content = JSON.stringify(body);
  }
  return worker.fetch(
    new Request("https://club.example" + path, {
      method,
      headers,
      ...(content !== undefined ? { body: content } : {}),
    }),
    runtime.env,
  );
}
async function view(owner) {
  const r = await call(undefined, "GET", undefined, { owner });
  expect(r.status).toBe(200);
  return r.json();
}
async function action(type, payload = {}, options = {}) {
  const response = await call("/api/v2/actions", "POST", { type, payload }, options);
  const body = await response.json();
  return { status: response.status, body };
}
async function okay(type, payload = {}, options = {}) {
  const r = await action(type, payload, options);
  expect(r, JSON.stringify(r)).toMatchObject({ status: 200 });
  return r.body.entityId;
}
function draft(state, overrides = {}) {
  return {
    name: "Test campagne",
    kind: "information",
    channel: "email",
    subject: "Bonjour {{prenom}}",
    body: "Rendez-vous au club",
    memberIds: state.core.members.slice(0, 9).map((m) => m.id),
    attachmentIds: [],
    ...overrides,
  };
}
it("authenticates API access and rejects cross-site mutations", async () => {
  expect((await call(undefined, "GET", undefined, { anonymous: true })).status).toBe(401);
  expect(
    (
      await call(
        "/api/v2/actions",
        "POST",
        { type: "settings.save", payload: {} },
        { headers: { Origin: "https://evil.example" } },
      )
    ).status,
  ).toBe(403);
  expect((await call("/api/v2/workspace")).status).toBe(200);
});
it("persists a single idempotent action, rejects key reuse, and isolates owners", async () => {
  const state = await view(),
    id = crypto.randomUUID();
  const campaign = await okay("campaign.save", draft(state), { id });
  const repeated = await okay("campaign.save", draft(state), { id });
  expect(repeated).toBe(campaign);
  expect((await view()).flow.campaigns.filter((c) => c.name === "Test campagne")).toHaveLength(1);
  expect((await action("campaign.save", draft(state, { name: "Different" }), { id })).status).toBe(
    409,
  );
  expect((await view("owner-two")).flow.campaigns.some((c) => c.id === campaign)).toBe(false);
});
it("stores large Unicode snapshots without oversized rows and rejects stale revisions", async () => {
  const { state, revision } = await loadWorkspace(runtime.env.DB, "large");
  state.flow.audit = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
    at: new Date().toISOString(),
    actor: "Coach",
    entityId: "large",
    entityType: "test",
    action: "note",
    detail: "⚽é".repeat(1200),
  }));
  expect(await persist(runtime.env.DB, "large", revision, state)).toBe(true);
  const again = await loadWorkspace(runtime.env.DB, "large");
  expect(again.state.flow.audit[499].detail).toBe("⚽é".repeat(1200));
  expect(again.revision).toBe(revision + 1);
  expect(await persist(runtime.env.DB, "large", revision, initialState())).toBe(false);
  expect((await loadWorkspace(runtime.env.DB, "large")).state.flow.audit).toHaveLength(500);
  const max = runtime.database
    .prepare("SELECT MAX(length(CAST(content AS BLOB))) AS size FROM workspace_chunks")
    .get();
  expect(max.size).toBeLessThan(1000000);
});
it("handles marketing consent, simulated failures, and retries only failures", async () => {
  const state = await view();
  const contact = state.core.members[0];
  await okay("profile.save", { id: contact.id, emailConsent: false, smsConsent: false });
  const id = await okay(
    "campaign.save",
    draft(state, { kind: "advertising", sponsorId: state.flow.sponsors[0].id }),
  );
  await okay("campaign.start", { id });
  let data = await view();
  expect(
    data.flow.deliveries.find((d) => d.campaignId === id && d.memberId === contact.id).status,
  ).toBe("excluded");
  expect((await action("campaign.start", { id })).status).toBe(422);
  const stored = await loadWorkspace(runtime.env.DB, "owner-one");
  const started = stored.state.flow.campaigns.find((c) => c.id === id).startedAt;
  tick(stored.state, new Date(Date.parse(started) + 20000).toISOString());
  await persist(runtime.env.DB, "owner-one", stored.revision, stored.state);
  data = await view();
  const before = data.flow.deliveries.filter((d) => d.campaignId === id);
  expect(before.some((d) => ["failed", "bounced"].includes(d.status))).toBe(true);
  const delivered = before
    .filter((d) => ["delivered", "opened", "clicked"].includes(d.status))
    .map((d) => d.id);
  await okay("campaign.retry", { id });
  data = await view();
  const after = data.flow.deliveries.filter((d) => d.campaignId === id);
  expect(after).toHaveLength(before.length);
  expect(after.filter((d) => delivered.includes(d.id)).every((d) => d.attempt === 1)).toBe(true);
  expect(after.some((d) => d.attempt === 2)).toBe(true);
});
it("schedules, pauses, resumes and cancels queued deliveries", async () => {
  const state = await view();
  const id = await okay("campaign.save", draft(state));
  expect((await action("campaign.schedule", { id, scheduledAt: "2000-01-01" })).status).toBe(422);
  const scheduledAt = new Date(Date.now() + 60000).toISOString();
  await okay("campaign.schedule", { id, scheduledAt });
  const stored = await loadWorkspace(runtime.env.DB, "owner-one");
  tick(stored.state, new Date(Date.now() + 61000).toISOString());
  await persist(runtime.env.DB, "owner-one", stored.revision, stored.state);
  await okay("campaign.pause", { id });
  await okay("campaign.resume", { id });
  await okay("campaign.cancel", { id });
  const data = await view();
  expect(data.flow.campaigns.find((c) => c.id === id).status).toBe("cancelled");
  expect(
    data.flow.deliveries.filter((d) => d.campaignId === id).every((d) => d.status === "cancelled"),
  ).toBe(true);
});
it("creates exact installments, clamps month-end, prevents overpayment and tracks refunds", async () => {
  const state = await view();
  const id = await okay("collection.save", {
    name: "Stage",
    purpose: "membership",
    amount: 10001,
    installments: 3,
    dueDate: "2027-01-31",
    memberIds: state.core.members.slice(0, 2).map((m) => m.id),
  });
  await okay("collection.open", { id });
  let data = await view();
  const charges = data.flow.charges.filter(
    (c) => c.collectionId === id && c.memberId === state.core.members[0].id,
  );
  expect(charges.map((c) => c.dueDate)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  expect(charges.reduce((sum, c) => sum + c.amount, 0)).toBe(10001);
  expect((await action("collection.open", { id })).status).toBe(422);
  const charge = charges[0];
  const requestId = crypto.randomUUID();
  await okay(
    "payment.record",
    { chargeId: charge.id, amount: charge.amount, method: "card", status: "pending" },
    { id: requestId },
  );
  expect(
    (await action("payment.record", { chargeId: charge.id, amount: 1, method: "cash" })).status,
  ).toBe(422);
  data = await view();
  const tx = data.flow.transactions.find((t) => t.chargeId === charge.id);
  await okay("payment.resolve", { id: tx.id, status: "succeeded" });
  expect(
    (await action("payment.record", { chargeId: charge.id, amount: 1, method: "cash" })).status,
  ).toBe(422);
  expect(
    (
      await action("payment.refund", {
        chargeId: charge.id,
        amount: charge.amount + 1,
        note: "Erreur",
      })
    ).status,
  ).toBe(422);
  await okay("payment.refund", { chargeId: charge.id, amount: 1000, note: "Avoir partiel" });
  data = await view();
  expect(paidAmount(charge.id, data.flow.transactions)).toBe(charge.amount - 1000);
  expect(chargeStatus(charge, data.flow.transactions)).toBe("partial");
});
it("creates reminders for unpaid members only", async () => {
  const state = await view();
  const id = await okay("collection.save", {
    name: "Stage",
    amount: 500,
    installments: 1,
    dueDate: "2026-11-01",
    memberIds: state.core.members.slice(0, 2).map((m) => m.id),
  });
  await okay("collection.open", { id });
  const data = await view();
  const charge = data.flow.charges.find((c) => c.collectionId === id);
  await okay("payment.record", { chargeId: charge.id, amount: 500, method: "cash" });
  const campaign = await okay("collection.remind", { id });
  expect((await view()).flow.campaigns.find((c) => c.id === campaign).memberIds).toEqual([
    state.core.members[1].id,
  ]);
});
async function upload(entityType = "document", entityId = "", options = {}) {
  const form = new FormData();
  form.append(
    "file",
    new File([options.content || "%PDF-1.7\nTest"], options.name || "preuve.pdf", {
      type: options.mime || "application/pdf",
    }),
  );
  form.append("entityType", entityType);
  form.append("entityId", entityId);
  if (options.replacesId) form.append("replacesId", options.replacesId);
  return call("/api/v2/files", "POST", form, options);
}
it("uploads real bytes, protects ownership, versions files, and rejects unsafe formats", async () => {
  const response = await upload();
  expect(response.status).toBe(201);
  const file = await response.json();
  const read = await call(file.url);
  expect(await read.text()).toBe("%PDF-1.7\nTest");
  expect(read.headers.get("content-disposition")).toContain("attachment");
  expect((await call(file.url, "GET", undefined, { owner: "owner-two" })).status).toBe(404);
  const next = await upload("document", "", { replacesId: file.id });
  expect((await next.json()).version).toBe(2);
  expect(
    (
      await upload("document", "", {
        content: "<html>evil</html>",
        name: "unsafe.svg",
        mime: "image/svg+xml",
      })
    ).status,
  ).toBe(422);
  expect((await call(file.url, "PATCH", { status: "rejected", note: "" })).status).toBe(422);
  expect((await call(file.url, "PATCH", { status: "rejected", note: "Illisible" })).status).toBe(
    200,
  );
});
it("requires checklist, proof and approval, records reasons and preserves comments", async () => {
  const state = await view();
  const id = await okay("task.save", {
    title: "Préparer les maillots",
    teamId: state.core.teams[0].id,
    memberId: state.core.members[0].id,
    dueAt: "2026-11-01T12:00:00Z",
    checklist: ["Compter"],
    requireProof: true,
  });
  await okay("task.transition", { id, status: "in_progress" });
  expect((await action("task.transition", { id, status: "submitted" })).status).toBe(422);
  let data = await view();
  const item = data.flow.workTasks.find((t) => t.id === id).checklist[0];
  await okay("task.check", { id, itemId: item.id, done: true });
  expect((await action("task.transition", { id, status: "submitted" })).status).toBe(422);
  expect((await upload("task", id)).status).toBe(201);
  await okay("task.transition", { id, status: "submitted" });
  expect((await action("task.check", { id, itemId: item.id, done: false })).status).toBe(422);
  expect((await action("task.transition", { id, status: "in_progress" })).status).toBe(422);
  await okay("task.transition", { id, status: "in_progress", reason: "Recompter les chasubles" });
  await okay("task.transition", { id, status: "submitted" });
  await okay("task.transition", { id, status: "done" });
  data = await view();
  expect(data.flow.workTasks.find((t) => t.id === id).comments[0].body).toContain("Recompter");
});
it("generates complete round robin with byes, ranks results and links the calendar", async () => {
  const state = await view();
  const id = await okay("competition.save", {
    name: "D1",
    season: "2026-2027",
    teams: [
      { name: "Club", internalTeamId: state.core.teams[0].id },
      { name: "Adversaire A" },
      { name: "Adversaire B" },
    ],
  });
  await okay("competition.generate", {
    id,
    startsAt: "2026-10-18T13:00:00Z",
    intervalDays: 7,
    returnLeg: true,
    timezone: "Europe/Paris",
  });
  let data = await view();
  let comp = data.flow.competitions.find((c) => c.id === id);
  expect(comp.fixtures).toHaveLength(6);
  expect(new Set(comp.fixtures.map((f) => f.homeId + "-" + f.awayId)).size).toBe(6);
  expect(comp.fixtures.filter((f) => f.eventId)).toHaveLength(4);
  expect(
    (await action("competition.generate", { id, startsAt: "2026-10-18T13:00:00Z" })).status,
  ).toBe(422);
  const f = comp.fixtures.find((f) => f.eventId);
  await okay("competition.fixture", {
    id,
    fixtureId: f.id,
    status: "played",
    startsAt: f.startsAt,
    location: "Stade",
    homeScore: 3,
    awayScore: 1,
  });
  data = await view();
  comp = data.flow.competitions.find((c) => c.id === id);
  expect(ranking(comp)[0].points).toBe(3);
  expect(data.core.events.find((e) => e.id === f.eventId).score_for).not.toBeNull();
  expect((await action("competition.finish", { id })).status).toBe(422);
  const dates = comp.fixtures.map((f) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(f.startsAt)),
  );
  expect(new Set(dates)).toEqual(new Set(["15 h"]));
});
it("saves secure conversations, attachments, reactions, and blocks archived replies", async () => {
  const state = await view();
  const id = await okay("conversation.save", {
    title: "Organisation",
    kind: "direct",
    memberIds: [state.core.members[0].id],
  });
  const file = await (await upload("conversation", id)).json();
  await okay("conversation.reply", { id, body: "Le dossier", attachmentIds: [file.id] });
  let data = await view();
  const message = data.flow.conversations.find((c) => c.id === id).messages[0];
  await okay("message.react", { id, messageId: message.id });
  await okay("conversation.toggle", { id, field: "archived" });
  expect((await action("conversation.reply", { id, body: "test" })).status).toBe(422);
  await okay("conversation.toggle", { id, field: "archived" });
  await okay("conversation.reply", { id, body: "Reprise" });
  data = await view();
  expect(data.flow.conversations.find((c) => c.id === id).messages).toHaveLength(2);
});
it("validates legacy core input and preserves local weekly times across DST", async () => {
  expect(
    (
      await call("/api/v1/events", "POST", {
        team_id: "seniors-a",
        kind: "match",
        title: "Test",
        starts_at: "invalid",
      })
    ).status,
  ).toBe(422);
  const r = await call("/api/v1/events/series", "POST", {
    team_id: "seniors-a",
    kind: "training",
    title: "Hebdomadaire",
    starts_at: "2026-10-18T13:00:00Z",
    repeat_until: "2026-11-02",
    interval_weeks: 1,
    timezone: "Europe/Paris",
  });
  expect(r.status, await r.clone().text()).toBe(201);
  const events = await r.json();
  expect(events.map((e) => e.starts_at)).toEqual([
    "2026-10-18T13:00:00.000Z",
    "2026-10-25T14:00:00.000Z",
    "2026-11-01T14:00:00.000Z",
  ]);
  expect(() => addLocalDays("2027-03-21T01:30:00Z", 7, "Europe/Paris")).toThrow();
});
it("retries file uploads without duplication and rejects a changed payload for the same key", async () => {
  const id = crypto.randomUUID();
  const first = await upload("document", "", { id });
  expect(first.status).toBe(201);
  expect((await upload("document", "", { id })).status).toBe(200);
  expect((await upload("document", "", { id, content: "%PDF-1.7\nOther" })).status).toBe(409);
  expect((await view()).files).toHaveLength(1);
  expect(runtime.objects.size).toBe(1);
});
it("imports CSV and XLSX with validation and skips duplicate members", async () => {
  const { zipSync, strToU8 } = await import("fflate");
  const xml =
    '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Prénom</t></is></c><c r="B1" t="inlineStr"><is><t>Nom</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Joueur Excel</t></is></c><c r="B2" t="inlineStr"><is><t>Importé</t></is></c></row></sheetData></worksheet>';
  const bytes = zipSync({ "xl/worksheets/sheet1.xml": strToU8(xml) });
  const form = new FormData();
  form.append(
    "file",
    new File([bytes], "membres.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const imported = await call("/api/v1/members/import?team_id=seniors-a", "POST", form);
  expect(imported.status, await imported.clone().text()).toBe(200);
  expect(await imported.json()).toEqual({ imported: 1, skipped: 0 });
  const csv = new FormData();
  csv.append(
    "file",
    new File(["Prénom;Nom\nJoueur Excel;Importé\nNouveau;CSV"], "membres.csv", {
      type: "text/csv",
    }),
  );
  const again = await call("/api/v1/members/import?team_id=seniors-a", "POST", csv);
  expect(await again.json()).toEqual({ imported: 1, skipped: 1 });
});
it("creates only new invitations and never silently re-sends an existing roster", async () => {
  const event = await (
    await call("/api/v1/events", "POST", {
      team_id: "seniors-a",
      title: "Test ciblage",
      kind: "match",
      starts_at: "2026-11-01T14:00:00Z",
    })
  ).json();
  const state = await view();
  const ids = state.core.members
    .filter((m) => m.team_id === "seniors-a")
    .slice(0, 2)
    .map((m) => m.id);
  const body = { event_id: event.id, member_ids: ids };
  const result = await call("/api/v1/invitations", "POST", body);
  expect(await result.json()).toHaveLength(2);
  await call("/api/v1/invitations", "POST", body);
  const data = await view();
  expect(data.flow.campaigns.filter((c) => c.eventId === event.id)).toHaveLength(1);
  expect(data.flow.campaigns.find((c) => c.eventId === event.id).memberIds).toEqual(ids);
});
it("keeps scheduled campaigns usable after a recipient is removed", async () => {
  const state = await view();
  const id = await okay("campaign.save", draft(state));
  const at = new Date(Date.now() + 60000).toISOString();
  await okay("campaign.schedule", { id, scheduledAt: at });
  await call("/api/v1/members/" + state.core.members[0].id, "DELETE");
  const stored = await loadWorkspace(runtime.env.DB, "owner-one");
  expect(() => tick(stored.state, new Date(Date.now() + 61000).toISOString())).not.toThrow();
  expect(
    stored.state.flow.deliveries.find(
      (d) => d.campaignId === id && d.memberId === state.core.members[0].id,
    ).reason,
  ).toContain("supprimé");
});
it("activates sponsor artwork and pauses it when the partner is archived", async () => {
  const state = await view();
  const sponsorId = state.flow.sponsors[0].id;
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "visuel.png", {
      type: "image/png",
    }),
  );
  form.append("entityType", "sponsor");
  form.append("entityId", sponsorId);
  const img = await (await call("/api/v2/files", "POST", form)).json();
  const id = await okay("placement.save", {
    sponsorId,
    name: "Offre club",
    surface: "dashboard",
    url: "https://example.org",
    imageId: img.id,
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    budget: 10000,
  });
  await okay("placement.status", { id, status: "active" });
  await okay("placement.simulate", { id, impressions: 100, clicks: 8 });
  await okay("sponsor.archive", { id: sponsorId });
  const data = await view();
  expect(data.flow.placements.find((p) => p.id === id)).toMatchObject({
    status: "paused",
    impressions: 100,
    clicks: 8,
  });
  expect((await action("placement.status", { id, status: "active" })).status).toBe(422);
});

it("notifies invited members of event changes, cancellation and restoration without duplicate no-op messages", async () => {
  const state = await view();
  const memberIds = state.core.members
    .filter((m) => m.team_id === "seniors-a")
    .slice(0, 2)
    .map((m) => m.id);
  const event = await (
    await call("/api/v1/events", "POST", {
      team_id: "seniors-a",
      title: "Cycle de vie",
      kind: "match",
      starts_at: "2026-11-01T14:00:00Z",
    })
  ).json();
  await call("/api/v1/invitations", "POST", { event_id: event.id, member_ids: memberIds });
  const id = crypto.randomUUID();
  expect(
    (await call(`/api/v1/events/${event.id}`, "PATCH", { location: "Nouveau stade" }, { id }))
      .status,
  ).toBe(200);
  await call(`/api/v1/events/${event.id}`, "PATCH", { location: "Nouveau stade" }, { id });
  await call(`/api/v1/events/${event.id}`, "PATCH", { location: "Nouveau stade" });
  let data = await view();
  const updates = data.flow.campaigns.filter(
    (c) => c.subject.startsWith("Événement modifié") && c.eventId === event.id,
  );
  expect(updates).toHaveLength(1);
  expect(updates[0].memberIds).toEqual(memberIds);
  expect(updates[0].body).toContain("Nouveau stade");
  await call(`/api/v1/events/${event.id}`, "PATCH", { is_cancelled: true });
  expect((await call("/api/v1/invitations/reminders", "POST", { event_id: event.id })).status).toBe(
    422,
  );
  await call(`/api/v1/events/${event.id}`, "PATCH", { is_cancelled: false });
  data = await view();
  expect(
    data.flow.campaigns.some(
      (c) => c.subject.startsWith("Événement annulé") && c.eventId === event.id,
    ),
  ).toBe(true);
  expect(
    data.flow.campaigns.some(
      (c) => c.subject.startsWith("Événement rétabli") && c.eventId === event.id,
    ),
  ).toBe(true);
  await call(`/api/v1/events/${event.id}`, "PATCH", { score_for: 3, score_against: 2 });
  expect(
    (await view()).flow.campaigns.find(
      (c) => c.subject.startsWith("Résultat enregistré") && c.eventId === event.id,
    ).body,
  ).toContain("3 – 2");
});

it("shares a published lineup with starters and substitutes only, and sends again only after a change", async () => {
  const state = await view();
  const event = state.core.events.find((e) => e.team_id === "seniors-a" && !e.is_cancelled);
  const players = state.core.members.filter(
    (m) => m.team_id === "seniors-a" && m.role === "player",
  );
  const payload = {
    formation: "4-3-3",
    is_published: false,
    slots: [
      { member_id: players[0].id, role: "starter", position_index: 0 },
      { member_id: players[1].id, role: "substitute", position_index: null },
    ],
  };
  expect((await call(`/api/v1/lineups/${event.id}`, "PUT", payload)).status).toBe(200);
  expect(
    (await view()).flow.campaigns.filter((c) => c.subject.startsWith("Composition ")),
  ).toHaveLength(0);
  payload.is_published = true;
  expect((await call(`/api/v1/lineups/${event.id}`, "PUT", payload)).status).toBe(200);
  await call(`/api/v1/lineups/${event.id}`, "PUT", payload);
  let data = await view();
  const shared = data.flow.campaigns.filter((c) => c.subject.startsWith("Composition "));
  expect(shared).toHaveLength(1);
  expect(shared[0].memberIds).toEqual(players.slice(0, 2).map((p) => p.id));
  expect(shared[0].body).toContain(players[1].last_name);
  payload.slots[0].position_index = 1;
  await call(`/api/v1/lineups/${event.id}`, "PUT", payload);
  data = await view();
  expect(data.flow.campaigns.filter((c) => c.subject.startsWith("Composition "))).toHaveLength(2);
  expect(data.flow.campaigns[0].subject).toContain("actualisée");
});

it("creates payment confirmations only after resolution and tracks refusal and refund messages", async () => {
  const state = await view();
  const memberId = state.core.members[0].id;
  const collectionId = await okay("collection.save", {
    name: "Confirmation test",
    purpose: "membership",
    amount: 5000,
    installments: 1,
    dueDate: "2026-11-01",
    memberIds: [memberId],
  });
  await okay("collection.open", { id: collectionId });
  const charge = (await view()).flow.charges.find((c) => c.collectionId === collectionId);
  const count = (await view()).flow.campaigns.length;
  await okay("payment.record", {
    chargeId: charge.id,
    amount: 5000,
    method: "card",
    status: "pending",
  });
  let data = await view();
  expect(data.flow.campaigns).toHaveLength(count);
  const tx = data.flow.transactions.find((t) => t.chargeId === charge.id);
  await okay("payment.resolve", { id: tx.id, status: "failed" });
  data = await view();
  expect(data.flow.campaigns[0].subject).toContain("Paiement refusé");
  const requestId = crypto.randomUUID();
  await okay(
    "payment.record",
    { chargeId: charge.id, amount: 5000, method: "cash" },
    { id: requestId },
  );
  await okay(
    "payment.record",
    { chargeId: charge.id, amount: 5000, method: "cash" },
    { id: requestId },
  );
  data = await view();
  expect(
    data.flow.campaigns.filter((c) => c.subject === "Règlement enregistré · Confirmation test"),
  ).toHaveLength(1);
  expect(data.flow.campaigns[0].memberIds).toEqual([memberId]);
  expect(data.flow.campaigns[0].body).toContain("manuellement");
  await okay("payment.refund", { chargeId: charge.id, amount: 1000, note: "Retour équipement" });
  expect((await view()).flow.campaigns[0].subject).toContain("Remboursement confirmé");
});

it("notifies the assigned member through task completion and records discussion notifications without sending email", async () => {
  const state = await view();
  const member = state.core.members[0];
  const taskId = await okay("task.save", {
    title: "Apporter les ballons",
    teamId: member.team_id,
    memberId: member.id,
    dueAt: "2026-11-01T14:00:00Z",
    checklist: [],
  });
  await okay("task.transition", { id: taskId, status: "in_progress" });
  await okay("task.transition", { id: taskId, status: "submitted" });
  await okay("task.transition", { id: taskId, status: "done" });
  let data = await view();
  expect(data.flow.campaigns[0].body).toContain("terminé");
  expect(data.flow.campaigns[0].memberIds).toEqual([member.id]);
  const conversationId = await okay("conversation.save", {
    title: "Transport",
    kind: "direct",
    memberIds: [member.id],
  });
  await okay("conversation.reply", { id: conversationId, body: "Départ à 14 h" });
  data = await view();
  const campaign = data.flow.campaigns[0];
  expect(campaign.subject).toBe("Nouveau message · Transport");
  expect(campaign.channel).toBe("inapp");
  expect(data.flow.deliveries.find((d) => d.campaignId === campaign.id).channel).toBe("inapp");
});

it("rejects an empty published lineup, overlapping positions and editing after cancellation", async () => {
  const state = await view();
  const event = state.core.events.find((e) => e.team_id === "seniors-a" && !e.is_cancelled);
  const players = state.core.members.filter(
    (m) => m.team_id === "seniors-a" && m.role === "player",
  );
  const path = `/api/v1/lineups/${event.id}`;
  expect(
    (await call(path, "PUT", { formation: "4-3-3", is_published: true, slots: [] })).status,
  ).toBe(422);
  const payload = {
    formation: "4-3-3",
    is_published: true,
    slots: players
      .slice(0, 2)
      .map((m) => ({ member_id: m.id, role: "starter", position_index: 0 })),
  };
  expect((await call(path, "PUT", payload)).status).toBe(422);
  payload.slots[1].position_index = 1;
  await call(`/api/v1/events/${event.id}`, "PATCH", { is_cancelled: true });
  expect((await call(path, "PUT", payload)).status).toBe(422);
  expect((await view()).flow.campaigns.some((c) => c.subject.startsWith("Composition "))).toBe(
    false,
  );
});
