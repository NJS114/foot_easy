import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { FileRecord, WorkspaceState } from "../src/workflows/types";
import { initialState, hydrateCore } from "../src/server/state";
import { iso, uid, WorkflowError } from "../src/workflows/domain";

// One joined read produces a consistent snapshot, even while another request commits.
export async function loadWorkspace(db: D1Database, owner: string) {
  const read = async () =>
    (
      await db
        .prepare(
          "SELECT w.revision,w.data,c.part,c.content FROM workspaces w LEFT JOIN workspace_chunks c ON c.owner_id=w.owner_id WHERE w.owner_id=? ORDER BY c.part",
        )
        .bind(owner)
        .all<{ revision: number; data: string; part: number | null; content: string | null }>()
    ).results;
  let rows = await read();
  if (!rows.length) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO workspaces (owner_id,revision,data,updated_at) VALUES (?,0,?,?)",
      )
      .bind(owner, JSON.stringify(initialState()), iso())
      .run();
    rows = await read();
  }
  if (!rows.length)
    throw new WorkflowError(
      "La sauvegarde est momentanément indisponible.",
      503,
      "storage_unavailable",
    );
  const metadata = JSON.parse(rows[0].data);
  const state = (
    metadata.chunked ? JSON.parse(rows.map((r) => r.content || "").join("")) : metadata
  ) as WorkspaceState;
  hydrateCore(state.core);
  return { state, revision: rows[0].revision };
}
export async function listFiles(db: D1Database, owner: string): Promise<FileRecord[]> {
  const result = await db
    .prepare(
      "SELECT id,root_id AS rootId,version,name,mime,size,entity_type AS entityType,entity_id AS entityId,category,status,expires_at AS expiresAt,note,created_at AS createdAt FROM files WHERE owner_id=? ORDER BY created_at DESC",
    )
    .bind(owner)
    .all<Omit<FileRecord, "url">>();
  return result.results.map((f) => ({ ...f, url: `/api/v2/files/${f.id}` }));
}
// D1 has a per-row size limit. Split snapshots without splitting Unicode pairs and
// guard every write with the winning revision/token. D1 batch commits atomically.
export async function persist(
  db: D1Database,
  owner: string,
  revision: number,
  state: WorkspaceState,
  operation?: { id: string; response: string },
) {
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).length > 12_000_000)
    throw new WorkflowError(
      "La capacité de cet espace de démonstration est atteinte. Contactez le gestionnaire avant d’ajouter un historique.",
      507,
      "workspace_capacity",
    );
  const chunks: string[] = [];
  for (let offset = 0; offset < serialized.length;) {
    let end = Math.min(offset + 200000, serialized.length);
    const last = serialized.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(serialized.slice(offset, end));
    offset = end;
  }
  const writeId = uid(),
    now = iso(),
    guard =
      "EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND revision=? AND json_extract(data,'$.writeId')=?)";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE workspaces SET revision=revision+1,data=?,updated_at=? WHERE owner_id=? AND revision=?",
      )
      .bind(JSON.stringify({ chunked: true, writeId }), now, owner, revision),
    db
      .prepare(`DELETE FROM workspace_chunks WHERE owner_id=? AND ${guard}`)
      .bind(owner, owner, revision + 1, writeId),
  ];
  chunks.forEach((chunk, part) =>
    statements.push(
      db
        .prepare(`INSERT INTO workspace_chunks (owner_id,part,content) SELECT ?,?,? WHERE ${guard}`)
        .bind(owner, part, chunk, owner, revision + 1, writeId),
    ),
  );
  if (operation)
    statements.push(
      db
        .prepare(
          `INSERT INTO operations (id,owner_id,response,created_at) SELECT ?,?,?,? WHERE ${guard}`,
        )
        .bind(operation.id, owner, operation.response, now, owner, revision + 1, writeId),
    );
  const result = await db.batch(statements);
  return result[0].meta.changes === 1;
}
