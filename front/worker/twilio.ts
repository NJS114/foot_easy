import type { D1Database } from "@cloudflare/workers-types";
import type { TwilioTestConfig, TwilioTestRecord } from "../src/workflows/twilio-types";
import { WorkflowError } from "../src/workflows/domain";

export interface LocalTwilioEnv {
  LOCAL_DEVELOPMENT?: string;
  TWILIO_TEST_ENABLED?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_API_KEY_SID?: string;
  TWILIO_API_KEY_SECRET?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  TWILIO_TEST_TO?: string;
  DB: D1Database;
}
type Operation = {
  fingerprint: string;
  record: TwilioTestRecord;
  state: "sending" | "accepted" | "failed" | "unknown";
};
const prefix = "twilio-test:";
const phone = /^\+[1-9]\d{7,14}$/;
const statuses = [
  "accepted",
  "queued",
  "sending",
  "sent",
  "delivered",
  "undelivered",
  "failed",
  "canceled",
];
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
const errorDetail = (code: number | null) =>
  (
    ({
      20003: "Identifiants Twilio refusés. Vérifiez le compte et le token ou la clé API.",
      21211: "Numéro destinataire invalide. Utilisez le format international +33….",
      21606: "Expéditeur Twilio invalide ou non autorisé pour les SMS.",
      21608: "Compte d’essai : vérifiez le numéro destinataire dans la console Twilio.",
      21408: "Ce pays n’est pas autorisé dans les permissions SMS de Twilio.",
      21610: "Ce destinataire est désinscrit des messages de cet expéditeur.",
      20429: "Limite Twilio atteinte. Attendez avant un nouvel essai.",
    }) as Record<number, string>
  )[code || 0] ||
  `Twilio signale une erreur${code ? ` (${code})` : ""}. Consultez son journal Messaging.`;

function configuration(env: LocalTwilioEnv) {
  const account = env.TWILIO_ACCOUNT_SID?.trim() || "";
  const apiKey = env.TWILIO_API_KEY_SID?.trim() || "",
    apiSecret = env.TWILIO_API_KEY_SECRET?.trim() || "";
  const token = env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = env.TWILIO_FROM_NUMBER?.trim() || "",
    service = env.TWILIO_MESSAGING_SERVICE_SID?.trim() || "";
  const to = env.TWILIO_TEST_TO?.trim() || "",
    missing: string[] = [];
  if (!/^AC[0-9a-f]{32}$/i.test(account)) missing.push("TWILIO_ACCOUNT_SID");
  const useKey = !!(apiKey || apiSecret);
  if (useKey) {
    if (!/^SK[0-9a-f]{32}$/i.test(apiKey)) missing.push("TWILIO_API_KEY_SID");
    if (!apiSecret) missing.push("TWILIO_API_KEY_SECRET");
  } else if (!token) missing.push("TWILIO_AUTH_TOKEN");
  if (service ? !/^MG[0-9a-f]{32}$/i.test(service) : !phone.test(from))
    missing.push("TWILIO_FROM_NUMBER ou TWILIO_MESSAGING_SERVICE_SID");
  if (!phone.test(to)) missing.push("TWILIO_TEST_TO");
  return {
    account,
    username: useKey ? apiKey : account,
    password: useKey ? apiSecret : token,
    from,
    service,
    to,
    missing,
    authMode: useKey ? "Clé API" : "Account SID / Auth Token",
  };
}
function assertLocal(request: Request, env: LocalTwilioEnv) {
  if (env.LOCAL_DEVELOPMENT !== "true")
    throw new WorkflowError("Test Twilio disponible uniquement en local.", 404);
  const url = new URL(request.url);
  const isLocal = (value: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname) ||
    value.hostname.endsWith(".localhost");
  let allowed = isLocal(url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      allowed &&= isLocal(new URL(origin)) && origin === url.origin;
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw new WorkflowError("Le test SMS doit être lancé depuis localhost.", 403);
}
async function readOperation(db: D1Database, owner: string, id: string) {
  const row = await db
    .prepare("SELECT response FROM operations WHERE owner_id=? AND id=?")
    .bind(owner, prefix + id)
    .first<{ response: string }>();
  return row ? (JSON.parse(row.response) as Operation) : null;
}
async function saveOperation(db: D1Database, owner: string, operation: Operation) {
  await db
    .prepare("UPDATE operations SET response=? WHERE owner_id=? AND id=?")
    .bind(JSON.stringify(operation), owner, prefix + operation.record.id)
    .run();
}
async function twilioRequest(
  config: ReturnType<typeof configuration>,
  path: string,
  body?: URLSearchParams,
) {
  // Never return upstream bodies, credentials or Authorization headers to the UI/logs.
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.account}/Messages${path}.json`,
      {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(body ? { body } : {}),
      },
    );
    const value = (await response.json()) as {
      sid?: string;
      status?: string;
      code?: number;
      error_code?: number | null;
    };
    if (!response.ok)
      return {
        ok: false as const,
        uncertain: response.status >= 500,
        code: typeof value.code === "number" ? value.code : null,
      };
    if (!/^(SM|MM)[0-9a-f]{32}$/i.test(value.sid || "") || !statuses.includes(value.status || ""))
      return { ok: false as const, uncertain: true, code: null };
    return {
      ok: true as const,
      sid: value.sid!,
      status: value.status!,
      code: typeof value.error_code === "number" ? value.error_code : null,
    };
  } catch {
    return { ok: false as const, uncertain: true, code: null };
  }
}
function replay(operation: Operation) {
  if (operation.state === "sending")
    throw new WorkflowError(
      "Ce test est déjà en cours. Vérifiez la console Twilio avant un nouvel essai.",
      409,
    );
  if (operation.state === "unknown") throw new WorkflowError(operation.record.detail, 502);
  if (operation.state === "failed") throw new WorkflowError(operation.record.detail, 422);
  return json(operation.record);
}
export async function twilioRoutes(
  request: Request,
  env: LocalTwilioEnv,
  owner: string,
  payload?: Record<string, unknown>,
): Promise<Response> {
  const path = new URL(request.url).pathname,
    config = configuration(env);
  if (path === "/api/v2/providers/twilio" && request.method === "GET") {
    if (env.LOCAL_DEVELOPMENT !== "true") return json({ local: false });
    assertLocal(request, env);
    const row = await env.DB.prepare(
      "SELECT response FROM operations WHERE owner_id=? AND id LIKE 'twilio-test:%' ORDER BY created_at DESC LIMIT 1",
    )
      .bind(owner)
      .first<{ response: string }>();
    const data: TwilioTestConfig = {
      local: true,
      enabled: env.TWILIO_TEST_ENABLED === "true",
      ready: !config.missing.length,
      missing: config.missing,
      sender: config.service || config.from,
      to: config.to,
      authMode: config.authMode,
      lastTest: row ? (JSON.parse(row.response) as Operation).record : null,
    };
    return json(data);
  }
  assertLocal(request, env);
  if (path === "/api/v2/providers/twilio/test" && request.method === "POST") {
    if (env.TWILIO_TEST_ENABLED !== "true")
      throw new WorkflowError(
        "Activez TWILIO_TEST_ENABLED=true dans front/.dev.vars et redémarrez le serveur.",
        403,
      );
    if (config.missing.length)
      throw new WorkflowError(
        `Configuration Twilio à compléter : ${config.missing.join(", ")}.`,
        422,
      );
    const to = typeof payload?.to === "string" ? payload.to.trim() : "",
      body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (to !== config.to)
      throw new WorkflowError(
        "Seul le numéro TWILIO_TEST_TO configuré peut recevoir ce test.",
        403,
      );
    if (!body || body.length > 1600 || payload?.confirm !== true)
      throw new WorkflowError(
        "Confirmez le test et renseignez un message de 1 à 1 600 caractères.",
        422,
      );
    const id = request.headers.get("x-request-id") || "";
    if (!/^[a-zA-Z0-9-]{10,100}$/.test(id))
      throw new WorkflowError("Identifiant de test invalide.", 400);
    const fingerprint = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            JSON.stringify([config.account, config.from, config.service, to, body]),
          ),
        ),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const previous = await readOperation(env.DB, owner, id);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new WorkflowError("Cet identifiant appartient à un autre test.", 409);
      return replay(previous);
    }
    const now = new Date().toISOString();
    const operation: Operation = {
      fingerprint,
      state: "sending",
      record: {
        id,
        sid: "",
        to,
        status: "sending",
        errorCode: null,
        detail: "Envoi en cours",
        createdAt: now,
        updatedAt: now,
      },
    };
    // Claim before calling Twilio. A timeout or repeated request never sends this test twice.
    const claim = await env.DB.prepare(
      "INSERT OR IGNORE INTO operations (id,owner_id,response,created_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM operations WHERE owner_id=? AND id LIKE 'twilio-test:%' AND created_at>?)",
    )
      .bind(
        prefix + id,
        owner,
        JSON.stringify(operation),
        now,
        owner,
        new Date(Date.now() - 30000).toISOString(),
      )
      .run();
    if (claim.meta.changes !== 1) {
      const raced = await readOperation(env.DB, owner, id);
      if (raced) {
        if (raced.fingerprint !== fingerprint)
          throw new WorkflowError("Cet identifiant appartient à un autre test.", 409);
        return replay(raced);
      }
      throw new WorkflowError("Attendez 30 secondes entre deux SMS de test.", 429);
    }
    const form = new URLSearchParams({
      To: to,
      Body: body,
      ...(config.service ? { MessagingServiceSid: config.service } : { From: config.from }),
    });
    const result = await twilioRequest(config, "", form);
    operation.record.updatedAt = new Date().toISOString();
    if (!result.ok) {
      operation.state = result.uncertain ? "unknown" : "failed";
      operation.record.status = operation.state;
      operation.record.errorCode = result.code;
      operation.record.detail = result.uncertain
        ? "Twilio n’a pas confirmé l’envoi. Aucun renvoi automatique : vérifiez la console Twilio avant un nouvel essai."
        : errorDetail(result.code);
      await saveOperation(env.DB, owner, operation);
      return replay(operation);
    }
    operation.state = "accepted";
    Object.assign(operation.record, {
      sid: result.sid,
      status: result.status,
      errorCode: result.code,
      detail: result.code
        ? errorDetail(result.code)
        : "Message pris en charge par Twilio. Le statut suit sa distribution réelle.",
    });
    await saveOperation(env.DB, owner, operation);
    return json(operation.record, 201);
  }
  const match = /^\/api\/v2\/providers\/twilio\/test\/([a-zA-Z0-9-]{10,100})$/.exec(path);
  if (match && request.method === "GET") {
    const operation = await readOperation(env.DB, owner, match[1]);
    if (!operation) throw new WorkflowError("Test introuvable.", 404);
    if (!operation.record.sid) return json(operation.record);
    if (config.missing.length)
      throw new WorkflowError("Renseignez les identifiants Twilio pour actualiser le suivi.", 422);
    const result = await twilioRequest(config, `/${operation.record.sid}`);
    if (!result.ok)
      throw new WorkflowError(
        result.uncertain
          ? "Suivi Twilio momentanément indisponible. Aucun nouveau SMS n’a été envoyé."
          : errorDetail(result.code),
        502,
      );
    Object.assign(operation.record, {
      status: result.status,
      errorCode: result.code,
      updatedAt: new Date().toISOString(),
      detail: result.code ? errorDetail(result.code) : "Statut fourni par Twilio.",
    });
    await saveOperation(env.DB, owner, operation);
    return json(operation.record);
  }
  throw new WorkflowError("Route Twilio introuvable.", 404);
}
