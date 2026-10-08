import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createCoreAPI } from "../src/server/core-api";
import { applyAction, syncCoreTasks } from "../src/workflows/engine";
import { audit, iso, tick, uid, WorkflowError } from "../src/workflows/domain";
import type { Campaign, FileRecord, WorkspaceState } from "../src/workflows/types";
import { listFiles, loadWorkspace, persist } from "./storage";
import { twilioRoutes, type LocalTwilioEnv } from "./twilio";
import { notifyCoreChange } from "../src/workflows/notifications";

export interface Env extends LocalTwilioEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const message = (error: unknown) => (error instanceof Error ? error.message : "Erreur inconnue");
async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new WorkflowError(
      "Le fichier ou la requête dépasse la taille autorisée.",
      413,
      "too_large",
    );
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new WorkflowError("La taille maximale est dépassée.", 413, "too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}
const parse = (bytes: Uint8Array) => {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new WorkflowError("Requête JSON invalide.", 400);
  }
};
function actor(request: Request) {
  const name = request.headers.get("oai-authenticated-user-full-name");
  if (name) {
    try {
      return decodeURIComponent(name).slice(0, 160);
    } catch {
      return name.slice(0, 160);
    }
  }
  return "Gestionnaire du club";
}
function mediaType(bytes: Uint8Array, name: string, claimed: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png" && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
    return "image/png";
  if (
    ["jpg", "jpeg"].includes(ext || "") &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    ext === "webp" &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (ext === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return "application/pdf";
  if (["docx", "xlsx"].includes(ext || "") && bytes[0] === 80 && bytes[1] === 75)
    return ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (
    ["csv", "txt"].includes(ext || "") &&
    !bytes.includes(0) &&
    (!claimed || claimed.startsWith("text/") || claimed === "application/vnd.ms-excel")
  )
    return ext === "csv" ? "text/csv" : "text/plain";
  throw new WorkflowError(
    "Format non autorisé ou contenu incompatible. Utilisez PNG, JPEG, WebP, PDF, DOCX, XLSX, CSV ou TXT.",
  );
}
function entityExists(state: WorkspaceState, type: string, id: string) {
  if (["draft", "document"].includes(type)) return;
  if (type === "club" && state.core.clubs.some((x) => x.id === id)) return;
  const lists: Record<string, { id: string }[]> = {
    member: state.core.members,
    team: state.core.teams,
    event: state.core.events,
    campaign: state.flow.campaigns,
    conversation: state.flow.conversations,
    sponsor: state.flow.sponsors,
    placement: state.flow.placements,
    collection: state.flow.collections,
    charge: state.flow.charges,
    task: state.flow.workTasks,
    competition: state.flow.competitions,
    fixture: state.flow.competitions.flatMap((c) => c.fixtures),
  };
  if (!lists[type]?.some((x) => x.id === id))
    throw new WorkflowError("Le dossier de destination n’existe pas.", 404);
}

function fileOrganization(
  state: WorkspaceState,
  p: Record<string, unknown>,
  previous?: FileRecord,
) {
  const folderId = p.folderId === undefined ? previous?.folderId || "" : String(p.folderId);
  if (folderId && !state.flow.folders.some((f) => f.id === folderId))
    throw new WorkflowError("Dossier introuvable.", 404);
  const submittedByMemberId =
    p.submittedByMemberId === undefined
      ? previous?.submittedByMemberId || ""
      : String(p.submittedByMemberId);
  if (submittedByMemberId && !state.core.members.some((m) => m.id === submittedByMemberId))
    throw new WorkflowError("Membre déposant introuvable.", 404);
  const ids =
    p.recipientMemberIds === undefined ? previous?.recipientMemberIds || [] : p.recipientMemberIds;
  if (
    !Array.isArray(ids) ||
    ids.length > 1000 ||
    ids.some((id) => typeof id !== "string" || !state.core.members.some((m) => m.id === id))
  )
    throw new WorkflowError("Destinataires du document invalides.");
  return { folderId, submittedByMemberId, recipientMemberIds: [...new Set(ids as string[])] };
}

async function fileRoutes(
  request: Request,
  env: Env,
  owner: string,
  path: string,
): Promise<Response> {
  const fileId = path.split("/")[4];
  if (request.method === "GET" && fileId) {
    const file = await env.DB.prepare(
      "SELECT object_key, name, mime FROM files WHERE id=? AND owner_id=?",
    )
      .bind(fileId, owner)
      .first<{ object_key: string; name: string; mime: string }>();
    if (!file) throw new WorkflowError("Document introuvable.", 404);
    const object = await env.BUCKET.get(file.object_key);
    if (!object) throw new WorkflowError("Le fichier est momentanément indisponible.", 503);
    const download = new URL(request.url).searchParams.has("download");
    return new Response(object.body as unknown as BodyInit, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `${!download && file.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Content-Length": String(object.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }
  if (request.method === "POST" && !fileId) {
    const bytes = await limitedBody(request, 10 * 1024 * 1024 + 100000);
    const copy = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: bytes,
    });
    const form = await copy.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !file.size)
      throw new WorkflowError("Choisissez un fichier non vide.");
    if (file.size > 10 * 1024 * 1024) throw new WorkflowError("Le fichier dépasse 10 Mo.", 413);
    // Remove control characters and path separators from download names.
    // eslint-disable-next-line no-control-regex
    const name = file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180);
    const content = new Uint8Array(await file.arrayBuffer());
    const mime = mediaType(content, name, file.type);
    const { state } = await loadWorkspace(env.DB, owner);
    const entityType = String(form.get("entityType") || "document").slice(0, 40),
      entityId = String(form.get("entityId") || "").slice(0, 200);
    entityExists(state, entityType, entityId);
    const category = String(form.get("category") || "other").slice(0, 80);
    const replacesId = String(form.get("replacesId") || "");
    let version = 1;
    let rootId = "";
    if (replacesId) {
      const previous = await env.DB.prepare("SELECT root_id FROM files WHERE id=? AND owner_id=?")
        .bind(replacesId, owner)
        .first<{ root_id: string }>();
      if (!previous) throw new WorkflowError("Version précédente introuvable.", 404);
      rootId = previous.root_id;
      const last = await env.DB.prepare(
        "SELECT MAX(version) AS version FROM files WHERE owner_id=? AND root_id=?",
      )
        .bind(owner, rootId)
        .first<{ version: number }>();
      version = (last?.version || 0) + 1;
    }
    const previousFile = replacesId
      ? (await listFiles(env.DB, owner)).find((f) => f.id === replacesId)
      : undefined;
    let recipientMemberIds: unknown;
    if (form.has("recipientMemberIds")) {
      try {
        recipientMemberIds = JSON.parse(String(form.get("recipientMemberIds")));
      } catch {
        throw new WorkflowError("Destinataires invalides.");
      }
    }
    const organization = fileOrganization(
      state,
      {
        ...(form.has("folderId") ? { folderId: form.get("folderId") } : {}),
        ...(form.has("submittedByMemberId")
          ? { submittedByMemberId: form.get("submittedByMemberId") }
          : {}),
        ...(recipientMemberIds !== undefined ? { recipientMemberIds } : {}),
      },
      previousFile,
    );
    const id = request.headers.get("x-request-id") || uid();
    if (!/^[a-zA-Z0-9-]{10,100}$/.test(id))
      throw new WorkflowError("Identifiant de requête invalide.", 400);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", content)))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const uploadHash = JSON.stringify([
      digest,
      name,
      mime,
      entityType,
      entityId,
      category,
      replacesId,
      organization,
    ]);
    const previousUpload = await env.DB.prepare(
      "SELECT upload_hash FROM files WHERE id=? AND owner_id=?",
    )
      .bind(id, owner)
      .first<{ upload_hash: string }>();
    if (previousUpload) {
      if (previousUpload.upload_hash !== uploadHash)
        throw new WorkflowError("Ce téléversement correspond à un autre fichier.", 409);
      return json((await listFiles(env.DB, owner)).find((f) => f.id === id));
    }
    const key = `${owner}/${id}/${uid()}`;
    await env.BUCKET.put(key, content, { httpMetadata: { contentType: mime } });
    try {
      await env.DB.prepare(
        "INSERT INTO files (id,owner_id,object_key,upload_hash,root_id,version,name,mime,size,entity_type,entity_id,category,status,expires_at,note,created_at,folder_id,uploaded_by,submitted_by_member_id,recipient_member_ids) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,'',?,?,?,?,?)",
      )
        .bind(
          id,
          owner,
          key,
          uploadHash,
          rootId || id,
          version,
          name,
          mime,
          file.size,
          entityType,
          entityId,
          category,
          iso(),
          organization.folderId,
          actor(request),
          organization.submittedByMemberId,
          JSON.stringify(organization.recipientMemberIds),
        )
        .run();
    } catch (error) {
      await env.BUCKET.delete(key);
      const existing = await env.DB.prepare(
        "SELECT upload_hash FROM files WHERE id=? AND owner_id=?",
      )
        .bind(id, owner)
        .first<{ upload_hash: string }>();
      if (existing?.upload_hash === uploadHash)
        return json((await listFiles(env.DB, owner)).find((f) => f.id === id));
      if (String(error).includes("UNIQUE"))
        throw new WorkflowError("Une autre version vient d’être ajoutée. Réessayez.", 409);
      throw error;
    }
    return json(
      (await listFiles(env.DB, owner)).find((f) => f.id === id),
      201,
    );
  }
  if (request.method === "PATCH" && fileId) {
    const p = parse(await limitedBody(request, 100000));
    const files = await listFiles(env.DB, owner);
    const file = files.find((f) => f.id === fileId);
    if (!file) throw new WorkflowError("Document introuvable.", 404);
    const status = p.status === undefined ? file.status : String(p.status);
    if (!["pending", "approved", "rejected", "archived"].includes(status))
      throw new WorkflowError("Statut invalide.");
    const entityType = p.entityType === undefined ? file.entityType : String(p.entityType),
      entityId = p.entityId === undefined ? file.entityId : String(p.entityId);
    const { state } = await loadWorkspace(env.DB, owner);
    entityExists(state, entityType, entityId);
    const organization = fileOrganization(state, p, file);
    const expiresAt =
      p.expiresAt === undefined ? file.expiresAt : p.expiresAt ? String(p.expiresAt) : null;
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
      throw new WorkflowError("Date d’expiration invalide.");
    const note = String(p.note ?? file.note).slice(0, 3000);
    if (status === "rejected" && !note.trim())
      throw new WorkflowError("Précisez le motif du refus.");
    await env.DB.prepare(
      "UPDATE files SET status=?,entity_type=?,entity_id=?,category=?,expires_at=?,note=?,folder_id=?,submitted_by_member_id=?,recipient_member_ids=? WHERE id=? AND owner_id=?",
    )
      .bind(
        status,
        entityType,
        entityId,
        String(p.category ?? file.category).slice(0, 80),
        expiresAt,
        note,
        organization.folderId,
        organization.submittedByMemberId,
        JSON.stringify(organization.recipientMemberIds),
        fileId,
        owner,
      )
      .run();
    return json((await listFiles(env.DB, owner)).find((f) => f.id === fileId));
  }
  throw new WorkflowError("Route de documents introuvable.", 404);
}
function invitationCampaign(
  state: WorkspaceState,
  eventId: string,
  onlyPending: boolean,
  now: string,
  newMemberIds?: string[],
  files: FileRecord[] = [],
) {
  const event = state.core.events.find((e) => e.id === eventId);
  if (!event) return;
  const ids = state.core.invitations
    .filter(
      (i) =>
        i.event_id === eventId &&
        (!onlyPending || i.availability === "pending") &&
        (!newMemberIds || newMemberIds.includes(i.member.id)),
    )
    .map((i) => i.member.id);
  if (!ids.length) return;
  const campaign: Campaign = {
    id: uid(),
    name: `${onlyPending ? "Relance" : "Convocation"} · ${event.title}`,
    kind: onlyPending ? "reminder" : "invitation",
    channel: "email",
    subject: event.title,
    body: `Bonjour {{prenom}},\n\nVous êtes attendu pour ${event.title}. Retrouvez les informations pratiques dans votre espace club et indiquez votre disponibilité.`,
    memberIds: ids,
    attachmentIds: files
      .filter(
        (f) =>
          f.entityType === "event" &&
          f.entityId === eventId &&
          !["archived", "rejected"].includes(f.status) &&
          !files.some((other) => other.rootId === f.rootId && other.version > f.version),
      )
      .slice(0, 12)
      .map((f) => f.id),
    status: "draft",
    scheduledAt: null,
    startedAt: null,
    createdAt: now,
    eventId,
    sponsorId: "",
    ctaLabel: "",
    ctaUrl: "",
    audienceFrozen: false,
  };
  state.flow.campaigns.unshift(campaign);
  applyAction(state, "campaign.start", { id: campaign.id }, "Gestionnaire", [], now);
}
async function fetchApi(request: Request, env: Env, owner: string) {
  const path = new URL(request.url).pathname;
  const now = iso();
  if (path.startsWith("/api/v2/providers/twilio"))
    return twilioRoutes(
      request,
      env,
      owner,
      request.method === "POST" ? parse(await limitedBody(request, 10000)) : undefined,
    );
  if (path.startsWith("/api/v2/files")) return fileRoutes(request, env, owner, path);
  const mutating = !["GET", "HEAD"].includes(request.method);
  const body = mutating
    ? await limitedBody(
        request,
        path === "/api/v1/members/import" ? 2 * 1024 * 1024 + 100000 : 250000,
      )
    : null;
  const requestId = request.headers.get("x-request-id") || uid();
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(requestId))
    throw new WorkflowError("Identifiant de requête invalide.", 400);
  const fingerprint = mutating
    ? Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(request.method + path + new TextDecoder().decode(body!)),
          ),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
    : "";
  for (let retry = 0; retry < 4; retry++) {
    if (mutating) {
      const previous = await env.DB.prepare(
        "SELECT response FROM operations WHERE id=? AND owner_id=?",
      )
        .bind(requestId, owner)
        .first<{ response: string }>();
      if (previous) {
        const cached = JSON.parse(previous.response);
        if (cached.fingerprint !== fingerprint)
          throw new WorkflowError("Cet identifiant est déjà utilisé pour une autre action.", 409);
        return new Response(cached.body, { status: cached.status, headers: cached.headers });
      }
    }
    const { state, revision } = await loadWorkspace(env.DB, owner);
    const advanced = tick(state, now);
    let response: Response;
    if (path === "/api/v2/workspace" && request.method === "GET") {
      if (advanced && !(await persist(env.DB, owner, revision, state))) continue;
      return json({
        ...state,
        files: await listFiles(env.DB, owner),
        revision: revision + (advanced ? 1 : 0),
        user: { name: actor(request) },
        serverTime: now,
      });
    }
    if (path === "/api/v2/actions" && request.method === "POST") {
      const action = parse(body!);
      if (
        typeof action.type !== "string" ||
        !action.payload ||
        typeof action.payload !== "object" ||
        Array.isArray(action.payload)
      )
        throw new WorkflowError("Action invalide.", 400);
      const coreBefore = action.type === "competition.fixture" ? structuredClone(state.core) : null;
      const files = await listFiles(env.DB, owner);
      const result = applyAction(
        state,
        action.type,
        action.payload as Record<string, unknown>,
        actor(request),
        files,
        now,
      );
      if (coreBefore) {
        for (const event of state.core.events)
          notifyCoreChange(
            coreBefore,
            state,
            `/api/v1/events/${event.id}`,
            "PATCH",
            actor(request),
            now,
            files,
          );
      }
      response = json(result);
    } else if (path.startsWith("/api/v1/")) {
      const copy = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        ...(body ? { body } : {}),
      });
      if (request.method === "PATCH" && path.startsWith("/api/v1/events/")) {
        const eventId = path.split("/").pop();
        const competition = state.flow.competitions.find((c) =>
          c.fixtures.some((f) => f.eventId === eventId),
        );
        if (competition?.status === "finished")
          throw new WorkflowError("Le championnat lié est clôturé.");
        if (competition) {
          const payload = parse(body!);
          if (
            (Object.hasOwn(payload, "opponent") &&
              payload.opponent !== state.core.events.find((e) => e.id === eventId)?.opponent) ||
            (Object.hasOwn(payload, "venue") &&
              payload.venue !== state.core.events.find((e) => e.id === eventId)?.venue)
          )
            throw new WorkflowError("Les adversaires sont définis par le championnat.");
        }
      }
      const coreBefore = mutating ? structuredClone(state.core) : state.core;
      response = await createCoreAPI(state.core).fetch(copy);
      if (!response.ok) return response;
      if (mutating) {
        syncCoreTasks(state);
        if (
          (request.method === "PATCH" && path.startsWith("/api/v1/events/")) ||
          (request.method === "PUT" && path.startsWith("/api/v1/lineups/"))
        ) {
          notifyCoreChange(
            coreBefore,
            state,
            path,
            request.method,
            actor(request),
            now,
            await listFiles(env.DB, owner),
          );
        }
        if (request.method === "PATCH" && path.startsWith("/api/v1/events/")) {
          const eventId = path.split("/").pop();
          const event = state.core.events.find((e) => e.id === eventId);
          for (const competition of state.flow.competitions) {
            const fixture = competition.fixtures.find((f) => f.eventId === eventId);
            if (!fixture || !event) continue;
            fixture.startsAt = event.starts_at;
            fixture.location = event.location || "";
            const home = competition.teams.find((t) => t.id === fixture.homeId)?.internalTeamId;
            fixture.homeScore = home ? event.score_for : event.score_against;
            fixture.awayScore = home ? event.score_against : event.score_for;
            fixture.status = event.is_cancelled
              ? "cancelled"
              : event.score_for !== null && event.score_against !== null
                ? "played"
                : fixture.status === "played" || fixture.status === "cancelled"
                  ? "scheduled"
                  : fixture.status;
          }
        }
        if (path === "/api/v1/invitations" || path === "/api/v1/invitations/reminders") {
          const payload = parse(body!);
          const newMemberIds = path.endsWith("reminders")
            ? undefined
            : ((await response.clone().json()) as { member: { id: string } }[]).map(
                (i) => i.member.id,
              );
          invitationCampaign(
            state,
            String(payload.event_id),
            path.endsWith("reminders"),
            now,
            newMemberIds,
            await listFiles(env.DB, owner),
          );
        }
        audit(
          state,
          actor(request),
          "core",
          path,
          request.method,
          "Modification de la gestion sportive",
          now,
        );
      }
    } else throw new WorkflowError("Route introuvable.", 404);
    if (!mutating) {
      if (advanced && !(await persist(env.DB, owner, revision, state))) continue;
      return response;
    }
    const content = await response.text();
    const cache = {
      fingerprint,
      status: response.status,
      body: response.status === 204 ? null : content,
      headers: Object.fromEntries(response.headers),
    };
    try {
      if (
        await persist(env.DB, owner, revision, state, {
          id: requestId,
          response: JSON.stringify(cache),
        })
      )
        return new Response(cache.body, { status: cache.status, headers: cache.headers });
    } catch (error) {
      if (retry === 3) throw error;
    }
  }
  throw new WorkflowError(
    "Une autre modification est en cours. Réessayez ; votre saisie est conservée.",
    409,
    "concurrent_update",
  );
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) {
        let response = await env.ASSETS.fetch(request);
        if (response.status === 404 && !url.pathname.split("/").pop()?.includes("."))
          response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
        return response;
      }
      const owner = request.headers.get("oai-authenticated-user-id");
      if (!owner)
        throw new WorkflowError(
          "Connectez-vous à votre espace privé pour continuer.",
          401,
          "unauthorized",
        );
      if (!env.DB || !env.BUCKET)
        throw new WorkflowError(
          "La sauvegarde et les fichiers sont momentanément indisponibles.",
          503,
          "storage_unavailable",
        );
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (
          (origin && origin !== url.origin) ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          throw new WorkflowError("Origine non autorisée.", 403, "forbidden");
      }
      return await fetchApi(request, env, owner);
    } catch (error) {
      if (!(error instanceof WorkflowError)) console.error("Foot Easy API", message(error));
      return json(
        {
          code: error instanceof WorkflowError ? error.code : "server_error",
          message:
            error instanceof WorkflowError
              ? error.message
              : "La sauvegarde est indisponible. Votre saisie est conservée : réessayez.",
          errors: [],
        },
        error instanceof WorkflowError ? error.status : 503,
      );
    }
  },
};
