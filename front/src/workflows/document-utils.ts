import type { DocumentFolder, FileRecord, WorkspaceView } from "./types";

export function latestFiles(files: FileRecord[]) {
  const latest = new Map<string, FileRecord>();
  for (const file of files) {
    if (!latest.has(file.rootId) || latest.get(file.rootId)!.version < file.version)
      latest.set(file.rootId, file);
  }
  return [...latest.values()];
}
export function folderPath(folders: DocumentFolder[], id = ""): DocumentFolder[] {
  const path: DocumentFolder[] = [],
    seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.find((f) => f.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}
export function memberFiles(data: WorkspaceView, memberId: string) {
  const ids = new Set<string>();
  const events = new Set(
    data.core.invitations.filter((i) => i.member.id === memberId).map((i) => i.event_id),
  );
  const tasks = data.flow.workTasks.filter((t) => t.memberId === memberId);
  const charges = new Set(
    data.flow.charges.filter((c) => c.memberId === memberId).map((c) => c.id),
  );
  const collections = data.flow.collections.filter(
    (c) =>
      c.memberIds.includes(memberId) ||
      data.flow.charges.some(
        (charge) => charge.memberId === memberId && charge.collectionId === c.id,
      ),
  );
  const fixtures = data.flow.competitions
    .flatMap((c) => c.fixtures)
    .filter((f) => f.eventId && events.has(f.eventId));
  for (const c of collections) c.attachmentIds.forEach((id) => ids.add(id));
  for (const f of fixtures) f.attachmentIds.forEach((id) => ids.add(id));
  const conversations = data.flow.conversations.filter((c) => c.memberIds.includes(memberId));
  for (const c of data.flow.campaigns.filter(
    (c) => c.memberIds.includes(memberId) && !["draft", "cancelled"].includes(c.status),
  ))
    c.attachmentIds.forEach((id) => ids.add(id));
  for (const t of tasks)
    [...t.attachmentIds, ...t.comments.flatMap((c) => c.attachmentIds)].forEach((id) =>
      ids.add(id),
    );
  for (const c of conversations)
    c.messages.flatMap((m) => m.attachmentIds).forEach((id) => ids.add(id));
  return data.files.filter(
    (f) =>
      ids.has(f.id) ||
      f.submittedByMemberId === memberId ||
      f.recipientMemberIds?.includes(memberId) ||
      (f.entityType === "member" && f.entityId === memberId) ||
      (f.entityType === "event" && events.has(f.entityId)) ||
      (f.entityType === "task" && tasks.some((t) => t.id === f.entityId)) ||
      (f.entityType === "charge" && charges.has(f.entityId)) ||
      (f.entityType === "collection" && collections.some((c) => c.id === f.entityId)) ||
      (f.entityType === "fixture" && fixtures.some((fi) => fi.id === f.entityId)) ||
      (f.entityType === "conversation" && conversations.some((c) => c.id === f.entityId)),
  );
}
export function licenseStatus(data: WorkspaceView, memberId: string) {
  const member = data.core.members.find((m) => m.id === memberId);
  const files = latestFiles(data.files).filter(
    (f) =>
      ((f.entityType === "member" && f.entityId === memberId) ||
        f.submittedByMemberId === memberId ||
        f.recipientMemberIds?.includes(memberId)) &&
      f.category === "license" &&
      f.status !== "archived",
  );
  const today = new Date().toISOString().slice(0, 10);
  if (
    member?.license_number &&
    files.some((f) => f.status === "approved" && (!f.expiresAt || f.expiresAt >= today))
  )
    return "Complète";
  if (files.some((f) => f.status === "pending" && (!f.expiresAt || f.expiresAt >= today)))
    return "À vérifier";
  if (files.some((f) => f.status === "rejected")) return "Refusée";
  if (files.some((f) => f.expiresAt && f.expiresAt < today)) return "Expirée";
  return member?.license_number ? "Pièce manquante" : "À compléter";
}
export function archiveEntries(files: FileRecord[], folders: DocumentFolder[]) {
  const used = new Set<string>();
  const safe = (name: string) => name.replace(/[\x00-\x1f/\\]/g, "_").replace(/^\.+$/, "document"); // eslint-disable-line no-control-regex
  return files.map((file) => {
    const prefix = folderPath(folders, file.folderId)
      .map((f) => safe(f.name))
      .join("/");
    const base = [prefix, safe(file.name)].filter(Boolean).join("/");
    let path = base,
      n = 1;
    const dot = base.lastIndexOf("."),
      slash = base.lastIndexOf("/");
    while (used.has(path)) {
      n++;
      path = dot > slash + 1 ? `${base.slice(0, dot)} (${n})${base.slice(dot)}` : `${base} (${n})`;
    }
    used.add(path);
    return { file, path };
  });
}
