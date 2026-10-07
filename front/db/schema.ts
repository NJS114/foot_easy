import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  ownerId: text("owner_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    objectKey: text("object_key").notNull(),
    uploadHash: text("upload_hash").notNull().default(""),
    rootId: text("root_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: text("expires_at"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("files_owner_entity").on(t.ownerId, t.entityType, t.entityId),
    uniqueIndex("files_owner_root_version").on(t.ownerId, t.rootId, t.version),
  ],
);
export const operations = sqliteTable(
  "operations",
  {
    id: text("id").notNull(),
    ownerId: text("owner_id").notNull(),
    response: text("response").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("operations_owner_request").on(t.ownerId, t.id)],
);

export const workspaceChunks = sqliteTable(
  "workspace_chunks",
  {
    ownerId: text("owner_id").notNull(),
    part: integer("part").notNull(),
    content: text("content").notNull(),
  },
  (t) => [uniqueIndex("workspace_chunks_owner_part").on(t.ownerId, t.part)],
);
