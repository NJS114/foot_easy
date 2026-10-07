import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export function createEnvironment() {
  const database = new DatabaseSync(":memory:");
  for (const f of readdirSync(new URL("../../drizzle/", import.meta.url))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    database.exec(readFileSync(new URL("../../drizzle/" + f, import.meta.url), "utf8"));
  const statement = (sql, args = []) => ({
    sql,
    args,
    bind(...values) {
      return statement(sql, values);
    },
    async first(column) {
      const row = database.prepare(sql).get(...args);
      return row ? (column ? row[column] : row) : null;
    },
    async all() {
      return { results: database.prepare(sql).all(...args), success: true, meta: {} };
    },
    async run() {
      const result = database.prepare(sql).run(...args);
      return { success: true, results: [], meta: { changes: result.changes } };
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const objects = new Map();
  const bucket = {
    async put(key, body, options) {
      objects.set(key, { body: new Uint8Array(body), options });
    },
    async get(key) {
      const item = objects.get(key);
      return item ? { body: item.body, size: item.body.byteLength } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return {
    env: { DB: db, BUCKET: bucket, ASSETS: { fetch: async () => new Response("site") } },
    database,
    objects,
    close() {
      database.close();
    },
  };
}
