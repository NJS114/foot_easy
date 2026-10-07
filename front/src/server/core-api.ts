import { xlsxRows } from "./xlsx";
import { WorkflowError } from "../workflows/domain";
import { addLocalDays, calendarDate } from "../workflows/dates";
import { validateCoreInput } from "./validation";
import type {
  Member,
  Event,
  Invitation,
  TeamStats,
  AttendanceReport,
  TaskReport,
  LineupWrite,
  Schemas,
} from "@/api/client";
import type { CoreState } from "@/workflows/types";
import { formations, memberDefaults, eventDefaults, defaultTasks, id, stamp } from "@/demo/data";
export function createCoreAPI(state: CoreState) {
  const { clubs, teams, members, events, invitations, tasks, assignments, lineups, facts } = state;
  class DemoError extends Error {
    constructor(
      message: string,
      public status = 422,
      public code = "demo_validation",
    ) {
      super(message);
    }
  }
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const find = <T extends { id: string }>(items: T[], itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new DemoError("Élément introuvable.", 404, "not_found");
    return item;
  };
  const remove = <T>(items: T[], predicate: (item: T) => boolean) => {
    for (let i = items.length - 1; i >= 0; i--) if (predicate(items[i])) items.splice(i, 1);
  };
  const page = <T>(items: T[], q: URLSearchParams) => {
    const skip = Math.max(0, Number(q.get("skip") || 0));
    const limit = Math.min(100, Math.max(1, Number(q.get("limit") || 100)));
    return {
      items: items.slice(skip, skip + limit),
      total: items.length,
      skip,
      limit,
      has_more: skip + limit < items.length,
    };
  };
  const normalize = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  function directory(q: URLSearchParams) {
    const key = (q.get("sort") || "last_name") as keyof Member;
    return members
      .filter(
        (m) =>
          (!q.get("team_id") || m.team_id === q.get("team_id")) &&
          (!q.get("club_id") ||
            teams.some((t) => t.id === m.team_id && t.club_id === q.get("club_id"))) &&
          (!q.get("role") || m.role === q.get("role")) &&
          (!q.get("search") ||
            normalize(`${m.first_name} ${m.last_name} ${m.email || ""}`).includes(
              normalize(q.get("search")!),
            )),
      )
      .sort((a, b) =>
        key === "shirt_number"
          ? (a.shirt_number || 100) - (b.shirt_number || 100)
          : String(a[key] || "").localeCompare(String(b[key] || ""), "fr"),
      );
  }
  const isPresent = (i: Invitation) =>
    i.attendance ? ["on_time", "late"].includes(i.attendance) : i.availability === "available";
  const teamEvents = (teamId: string) =>
    events
      .filter((e) => e.team_id === teamId && !e.is_cancelled)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  function stats(teamId: string): TeamStats {
    const played = teamEvents(teamId).filter(
      (e) =>
        e.kind === "match" &&
        e.score_for !== null &&
        e.score_against !== null &&
        e.starts_at <= stamp(),
    );
    const results = played.map((e) =>
      e.score_for! > e.score_against! ? "W" : e.score_for === e.score_against ? "D" : "L",
    );
    const eventIds = new Set(teamEvents(teamId).map((e) => e.id));
    return {
      team_id: teamId,
      played: played.length,
      wins: results.filter((r) => r === "W").length,
      draws: results.filter((r) => r === "D").length,
      losses: results.filter((r) => r === "L").length,
      goals_for: played.reduce((n, e) => n + e.score_for!, 0),
      goals_against: played.reduce((n, e) => n + e.score_against!, 0),
      form: results.slice(-5),
      players: members
        .filter((m) => m.team_id === teamId && m.role === "player")
        .map((member) => {
          const inv = invitations.filter(
            (i) => i.member.id === member.id && eventIds.has(i.event_id),
          );
          const present = inv.filter(isPresent).length;
          const fs = facts.filter((f) => f.member.id === member.id && eventIds.has(f.event_id));
          return {
            member,
            selections: lineups.filter(
              (l) =>
                l.is_published &&
                eventIds.has(l.event_id) &&
                l.slots.some((s) => s.member.id === member.id),
            ).length,
            goals: fs.filter((f) => f.kind === "goal").length,
            assists: facts.filter(
              (f) => f.assist_member?.id === member.id && eventIds.has(f.event_id),
            ).length,
            yellow_cards: fs.filter((f) => f.kind === "yellow_card").length,
            red_cards: fs.filter((f) => f.kind === "red_card").length,
            invited: inv.length,
            present,
            absences: inv.filter((i) =>
              i.attendance ? !isPresent(i) : i.availability === "unavailable",
            ).length,
            attendance_rate: inv.length ? present / inv.length : null,
          };
        }),
    };
  }
  function attendance(teamId: string): AttendanceReport {
    const columns = teamEvents(teamId).filter((e) => e.starts_at <= stamp());
    return {
      team_id: teamId,
      events: columns,
      rows: members
        .filter((m) => m.team_id === teamId && m.role === "player")
        .map((member) => {
          const inv = columns.map((e) =>
            invitations.find((i) => i.event_id === e.id && i.member.id === member.id),
          );
          return {
            member,
            cells: inv.map((i) => i?.attendance || i?.availability || "not_invited"),
            present: inv.filter((i) => i && isPresent(i)).length,
            invited: inv.filter(Boolean).length,
          };
        }),
    };
  }
  function taskReport(teamId: string): TaskReport {
    const columns = tasks.filter((t) => t.team_id === teamId);
    return {
      team_id: teamId,
      tasks: columns,
      rows: members
        .filter((m) => m.team_id === teamId)
        .map((member) => {
          const counts = columns.map(
            (t) =>
              assignments.filter((a) => a.task.id === t.id && a.member.id === member.id).length,
          );
          return { member, counts, total: counts.reduce((a, b) => a + b, 0) };
        })
        .sort((a, b) => b.total - a.total),
    };
  }
  function csvRows(text: string): string[][] {
    const delimiter = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === delimiter && !quoted) {
        row.push(cell);
        cell = "";
      } else if (c === "\n" && !quoted) {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (cell || row.length) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows;
  }
  async function importMembers(request: Request, q: URLSearchParams) {
    const teamId = q.get("team_id") || "";
    find(teams, teamId);
    const file = (await request.formData()).get("file");
    if (!file || typeof file === "string")
      throw new DemoError("Choisissez un fichier CSV ou XLSX.");
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["csv", "xlsx"].includes(extension || ""))
      throw new DemoError("Utilisez un fichier CSV ou XLSX.");
    if (file.size > 2_000_000) throw new DemoError("Le fichier dépasse 2 Mo.");
    const [headers, ...rows] =
      extension === "xlsx"
        ? xlsxRows(new Uint8Array(await file.arrayBuffer()))
        : csvRows(await file.text());
    if (!headers) throw new DemoError("Le fichier est vide.");
    if (rows.length > 1000) throw new DemoError("Maximum 1 000 lignes par import.");
    const aliases: Record<string, string> = {
      prenom: "first_name",
      nom: "last_name",
      "nom de famille": "last_name",
      mail: "email",
      "e-mail": "email",
      telephone: "phone",
      tel: "phone",
      licence: "license_number",
      taille: "jersey_size",
      fonction: "role",
      poste: "position",
      numero: "shirt_number",
      "date de naissance": "birth_date",
    };
    const keys = headers.map((h) => aliases[normalize(h)] || normalize(h));
    if (!keys.includes("first_name") || !keys.includes("last_name"))
      throw new DemoError("Ajoutez les colonnes Prénom et Nom.");
    let imported = 0,
      skipped = 0;
    for (const cells of rows) {
      if (cells.every((v) => !v.trim())) continue;
      const raw = Object.fromEntries(keys.map((k, i) => [k, cells[i]?.trim() || null]));
      if (
        !raw.first_name ||
        !raw.last_name ||
        members.some(
          (m) =>
            m.team_id === teamId &&
            normalize(m.first_name) === normalize(raw.first_name!) &&
            normalize(m.last_name) === normalize(raw.last_name!),
        )
      ) {
        skipped++;
        continue;
      }
      const roleMap: Record<string, Member["role"]> = {
        player: "player",
        volunteer: "volunteer",
        joueur: "player",
        joueuse: "player",
        entraineur: "coach",
        coach: "coach",
        benevole: "volunteer",
        staff: "staff",
      };
      const role = roleMap[normalize(raw.role || "joueur")] || "player";
      try {
        const candidate = validateCoreInput("POST", "/api/v1/members", {
          team_id: teamId,
          first_name: raw.first_name,
          last_name: raw.last_name,
          email: raw.email,
          phone: raw.phone,
          license_number: raw.license_number,
          role,
          jersey_size: raw.jersey_size || null,
          position: raw.position || null,
          shirt_number: raw.shirt_number ? Number(raw.shirt_number) : null,
          birth_date: raw.birth_date
            ? Number(raw.birth_date) > 0
              ? new Date((Number(raw.birth_date) - 25569) * 86400000).toISOString().slice(0, 10)
              : raw.birth_date
            : null,
        });
        members.push({ ...memberDefaults, ...candidate, id: id(), created_at: stamp() });
      } catch {
        skipped++;
        continue;
      }
      imported++;
    }
    return json({ imported, skipped });
  }
  function validateEvent(e: Event) {
    find(teams, e.team_id);
    if (!e.title.trim() || !Number.isFinite(Date.parse(e.starts_at)))
      throw new DemoError("Renseignez le titre et une date valide.");
    if (e.ends_at && e.ends_at <= e.starts_at)
      throw new DemoError("La fin doit être après le début.");
    if (e.meeting_at && e.meeting_at > e.starts_at)
      throw new DemoError("Le rendez-vous doit précéder le début.");
  }
  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace("/api/v1", "");
    const q = url.searchParams;
    const method = request.method;
    if (path === "/members/import" && method === "POST") return importMembers(request, q);
    if (path === "/members/export") {
      const fields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "role",
        "position",
        "shirt_number",
      ];
      const escape = (v: unknown) => {
        let value = String(v ?? "");
        if (/^[-=+@]/.test(value)) value = "'" + value;
        return '"' + value.replace(/"/g, '""') + '"';
      };
      const csv =
        "\uFEFF" +
        [fields, ...directory(q).map((m) => fields.map((k) => m[k as keyof Member]))]
          .map((row) => row.map(escape).join(";"))
          .join("\r\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv;charset=utf-8" } });
    }
    // Validate every mutation before applying it to the isolated workspace snapshot.
    const body =
      method === "GET" || method === "DELETE"
        ? {}
        : validateCoreInput(request.method, url.pathname, JSON.parse(await request.text()));
    const [resource, entityId, sub] = path.slice(1).split("/");
    if (resource === "clubs") {
      if (method === "GET") return json(page(clubs, q));
      if (method === "PATCH") {
        const club = find(clubs, entityId);
        Object.assign(club, body);
        return json(club);
      }
      if (method === "POST") {
        const club = { ...body, id: id(), created_at: stamp() };
        clubs.push(club);
        return json(club, 201);
      }
    }
    if (resource === "teams") {
      if (method === "GET")
        return json(
          entityId
            ? find(teams, entityId)
            : page(
                teams.filter((t) => !q.get("club_id") || t.club_id === q.get("club_id")),
                q,
              ),
        );
      if (method === "PATCH") {
        const team = find(teams, entityId);
        Object.assign(team, body);
        return json(team);
      }
      if (method === "POST") {
        find(clubs, body.club_id);
        const team = { ...body, id: id(), created_at: stamp() };
        teams.push(team);
        return json(team, 201);
      }
    }
    if (resource === "members") {
      if (method === "GET") return json(entityId ? find(members, entityId) : page(directory(q), q));
      if (method === "POST") {
        find(teams, body.team_id);
        if (!body.first_name?.trim() || !body.last_name?.trim())
          throw new DemoError("Prénom et nom requis.");
        const member = { ...memberDefaults, ...body, id: id(), created_at: stamp() };
        members.push(member);
        return json(member, 201);
      }
      const member = find(members, entityId);
      if (method === "PATCH") {
        Object.assign(member, body);
        return json(member);
      }
      if (method === "DELETE") {
        remove(members, (m) => m.id === entityId);
        remove(invitations, (i) => i.member.id === entityId);
        remove(assignments, (a) => a.member.id === entityId);
        remove(facts, (f) => f.member.id === entityId);
        for (const f of facts) if (f.assist_member?.id === entityId) f.assist_member = null;
        for (const l of lineups) remove(l.slots, (s) => s.member.id === entityId);
        return new Response(null, { status: 204 });
      }
    }
    if (resource === "events") {
      if (method === "GET")
        return json(
          entityId
            ? find(events, entityId)
            : page(
                events
                  .filter(
                    (e) =>
                      (!q.get("team_id") || e.team_id === q.get("team_id")) &&
                      (!q.get("kind") || e.kind === q.get("kind")),
                  )
                  .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
                q,
              ),
        );
      if (method === "POST") {
        if (entityId === "series") {
          const seriesId = id();
          const created: Event[] = [];
          const first = new Date(body.starts_at);
          let current = new Date(first);
          const weeks = Math.min(4, Math.max(1, Number(body.interval_weeks) || 1));
          for (
            let i = 0;
            i < 104 &&
            calendarDate(current.toISOString(), body.timezone || "Europe/Paris") <=
              body.repeat_until;
            i++
          ) {
            const delta = current.getTime() - first.getTime();
            const event = {
              ...eventDefaults,
              ...body,
              id: id(),
              series_id: seriesId,
              starts_at: current.toISOString(),
              ends_at: body.ends_at
                ? new Date(Date.parse(body.ends_at) + delta).toISOString()
                : null,
              meeting_at: body.meeting_at
                ? new Date(Date.parse(body.meeting_at) + delta).toISOString()
                : null,
              created_at: stamp(),
            };
            validateEvent(event);
            created.push(event);
            current = new Date(
              addLocalDays(
                first.toISOString(),
                (i + 1) * 7 * weeks,
                body.timezone || "Europe/Paris",
              ),
            );
          }
          if (!created.length)
            throw new DemoError("La fin de répétition doit suivre le premier événement.");
          events.push(...created);
          return json(created, 201);
        }
        const event = { ...eventDefaults, ...body, id: id(), created_at: stamp() };
        validateEvent(event);
        events.push(event);
        return json(event, 201);
      }
      if (method === "PATCH") {
        const event = find(events, entityId);
        validateEvent({ ...event, ...body });
        Object.assign(event, body);
        return json(event);
      }
    }
    if (resource === "invitations") {
      if (method === "GET") {
        const list = invitations.filter((i) => i.event_id === q.get("event_id"));
        if (entityId === "summary")
          return json({
            event_id: q.get("event_id"),
            invited: list.length,
            pending: list.filter((i) => i.availability === "pending").length,
            available: list.filter((i) => i.availability === "available").length,
            uncertain: list.filter((i) => i.availability === "uncertain").length,
            unavailable: list.filter((i) => i.availability === "unavailable").length,
          });
        return json(page(list, q));
      }
      if (method === "POST" && entityId === "reminders") {
        if (find(events, body.event_id).is_cancelled)
          throw new DemoError("Cet événement est annulé.");
        const list = invitations.filter(
          (i) => i.event_id === body.event_id && i.availability === "pending",
        );
        list.forEach((i) => {
          i.reminder_count++;
          i.last_reminded_at = stamp();
        });
        return json({ event_id: body.event_id, reminded: list.length });
      }
      if (method === "POST") {
        const event = find(events, body.event_id);
        if (event.is_cancelled)
          throw new DemoError("Un événement annulé ne peut pas recevoir de convocations.");
        if (body.member_ids)
          for (const memberId of body.member_ids) {
            if (find(members, memberId).team_id !== event.team_id)
              throw new DemoError("Choisissez des membres de cette équipe.");
          }
        const created = members
          .filter(
            (m) =>
              m.team_id === event.team_id &&
              (!body.member_ids || body.member_ids.includes(m.id)) &&
              !invitations.some((i) => i.event_id === event.id && i.member.id === m.id),
          )
          .map((member) => ({
            id: id(),
            event_id: event.id,
            member,
            availability: "pending" as const,
            comment: null,
            attendance: null,
            responded_at: null,
            reminder_count: 0,
            last_reminded_at: null,
          }));
        invitations.push(...created);
        return json(created, 201);
      }
      if (method === "PATCH") {
        const inv = find(invitations, entityId);
        Object.assign(inv, body, sub === "attendance" ? {} : { responded_at: stamp() });
        return json(inv);
      }
    }
    if (resource === "tasks") {
      if (entityId === "assignments") {
        if (method === "GET")
          return json(assignments.filter((a) => a.event_id === q.get("event_id")));
        if (method === "POST") {
          const task = find(tasks, body.team_task_id),
            member = find(members, body.member_id),
            event = find(events, body.event_id);
          if (task.team_id !== event.team_id || member.team_id !== event.team_id)
            throw new DemoError("Choisissez un membre de cette équipe.");
          const existing = assignments.find(
            (a) => a.event_id === event.id && a.member.id === member.id && a.task.id === task.id,
          );
          if (existing) return json(existing);
          const assignment = { id: id(), event_id: event.id, task, member };
          assignments.push(assignment);
          return json(assignment, 201);
        }
        if (method === "DELETE") {
          remove(assignments, (a) => a.id === sub);
          return new Response(null, { status: 204 });
        }
      }
      if (method === "GET")
        return json(
          page(
            tasks.filter((t) => t.team_id === q.get("team_id")),
            q,
          ),
        );
      if (method === "POST" && entityId === "defaults") {
        find(teams, body.team_id);
        const created = defaultTasks
          .filter((t) => !tasks.some((x) => x.team_id === body.team_id && x.name === t.name))
          .map((t) => ({ ...t, id: id(), team_id: body.team_id }));
        tasks.push(...created);
        return json({ added: created.length });
      }
      if (method === "POST") {
        find(teams, body.team_id);
        if (!body.name?.trim()) throw new DemoError("Le nom de la tâche est requis.");
        const task = { ...body, id: id() };
        tasks.push(task);
        return json(task, 201);
      }
      if (method === "DELETE") {
        remove(tasks, (t) => t.id === entityId);
        remove(assignments, (a) => a.task.id === entityId);
        return new Response(null, { status: 204 });
      }
    }
    if (resource === "lineups") {
      if (entityId === "formations") return json(formations);
      if (method === "GET") {
        const lineup = lineups.find((l) => l.event_id === entityId);
        if (!lineup)
          throw new DemoError("Aucune composition enregistrée.", 404, "lineup_not_found");
        return json(lineup);
      }
      if (method === "PUT") {
        const data = body as LineupWrite;
        const event = find(events, entityId);
        if (event.is_cancelled)
          throw new DemoError("Rétablissez l’événement avant de modifier sa composition.");
        const formation = formations.find((f) => f.code === data.formation);
        if (!formation) throw new DemoError("Schéma inconnu.");
        if (data.is_published && !data.slots.length)
          throw new DemoError("Ajoutez au moins un joueur avant de publier.");
        const used = new Set<string>();
        const positions = new Set<number>();
        const slots = data.slots.map((s) => {
          const member = find(members, s.member_id);
          if (member.role !== "player" || member.team_id !== event.team_id || used.has(member.id))
            throw new DemoError("Chaque joueur doit apparaître une seule fois dans son équipe.");
          if (s.role === "starter") {
            const position = s.position_index;
            if (
              position === null ||
              position === undefined ||
              !Number.isInteger(position) ||
              position < 0 ||
              position >= formation.players ||
              positions.has(position)
            )
              throw new DemoError(
                "Chaque titulaire doit occuper une position distincte du schéma.",
              );
            positions.add(position);
          } else if (s.position_index !== null && s.position_index !== undefined) {
            throw new DemoError("Un remplaçant ne peut pas occuper une position sur le terrain.");
          }
          used.add(member.id);
          return { member, role: s.role, position_index: s.position_index ?? null };
        });
        const updated = {
          id: lineups.find((l) => l.event_id === entityId)?.id || id(),
          event_id: entityId,
          formation: data.formation,
          is_published: data.is_published ?? false,
          slots,
          updated_at: stamp(),
          unavailable_member_ids: slots
            .filter(
              (s) =>
                !invitations.some(
                  (i) =>
                    i.event_id === entityId &&
                    i.member.id === s.member.id &&
                    i.availability === "available",
                ),
            )
            .map((s) => s.member.id),
        };
        remove(lineups, (l) => l.event_id === entityId);
        lineups.push(updated);
        return json(updated);
      }
    }
    if (resource === "match-facts") {
      if (method === "GET")
        return json(
          page(
            facts.filter((f) => f.event_id === q.get("event_id")),
            q,
          ),
        );
      if (method === "POST") {
        const event = find(events, body.event_id);
        const member = find(members, body.member_id);
        if (member.team_id !== event.team_id) throw new DemoError("Joueur d’une autre équipe.");
        const fact = {
          id: id(),
          event_id: event.id,
          kind: body.kind,
          minute: body.minute ?? null,
          member,
          assist_member: body.assist_member_id ? find(members, body.assist_member_id) : null,
        };
        facts.push(fact);
        return json(fact, 201);
      }
      if (method === "DELETE") {
        remove(facts, (f) => f.id === entityId);
        return new Response(null, { status: 204 });
      }
    }
    if (resource === "stats" && entityId === "teams") {
      find(teams, sub);
      const report = path.split("/")[4];
      return json(
        report === "attendance"
          ? attendance(sub)
          : report === "tasks"
            ? taskReport(sub)
            : stats(sub),
      );
    }
    throw new DemoError(
      "Ce parcours n’est pas disponible dans cette démonstration.",
      404,
      "demo_route_not_found",
    );
  }
  async function demoFetch(request: Request) {
    try {
      return await handle(request);
    } catch (error) {
      return json(
        {
          code:
            error instanceof DemoError || error instanceof WorkflowError
              ? error.code
              : "demo_error",
          message: error instanceof Error ? error.message : "Action impossible.",
          errors: [],
        } satisfies Schemas["ErrorResponse"],
        error instanceof DemoError || error instanceof WorkflowError ? error.status : 500,
      );
    }
  }

  return { fetch: demoFetch };
}
