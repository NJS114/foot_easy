// Local development adapter. Production identity is always provided by Sites.
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { context } from "esbuild";
// Keep credentials inside this API process; Vite never receives them.
try {
  process.loadEnvFile(resolve(".dev.vars"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const twilioKeys = [
  "TWILIO_TEST_ENABLED",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_TEST_TO",
];
const localTwilio = Object.fromEntries(twilioKeys.map((key) => [key, process.env[key] || ""]));
const directory = resolve(".local-data");
await mkdir(directory, { recursive: true });
const database = new DatabaseSync(resolve(directory, "club.sqlite"));
database.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY);",
);
for (const name of (await readdir("drizzle")).filter((n) => n.endsWith(".sql")).sort()) {
  if (database.prepare("SELECT name FROM local_migrations WHERE name=?").get(name)) continue;
  database.exec("BEGIN");
  try {
    database.exec(await readFile("drizzle/" + name, "utf8"));
    database.prepare("INSERT INTO local_migrations(name) VALUES(?)").run(name);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
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
      const results = statements.map((s) => {
        const result = database.prepare(s.sql).run(...s.args);
        return { success: true, results: [], meta: { changes: result.changes } };
      });
      database.exec("COMMIT");
      return results;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};
const objectPath = (key) => {
  const path = resolve(directory, "files", key);
  if (!path.startsWith(resolve(directory, "files") + "/")) throw new Error("Invalid object key");
  return path;
};
const bucket = {
  async put(key, bytes) {
    const path = objectPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, new Uint8Array(bytes));
  },
  async get(key) {
    try {
      const body = await readFile(objectPath(key));
      return { body, size: body.byteLength };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  },
  async delete(key) {
    await unlink(objectPath(key)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  },
};
let worker;
await mkdir(".local-data/build", { recursive: true });
const build = await context({
  entryPoints: ["worker/index.ts"],
  outfile: ".local-data/build/worker.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  tsconfig: "tsconfig.worker.json",
  plugins: [
    {
      name: "reload",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length) return;
          worker = (
            await import(
              pathToFileURL(resolve(".local-data/build/worker.mjs")).href + "?version=" + Date.now()
            )
          ).default;
        });
      },
    },
  ],
});
await build.rebuild();
await build.watch();
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 11 * 1024 * 1024) {
        res.writeHead(413);
        res.end("Maximum 10 Mo par fichier");
        return;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    }
    // Only this loopback development server injects a local test identity.
    headers.set("oai-authenticated-user-id", "local-developer");
    headers.set("oai-authenticated-user-full-name", "Gestionnaire local");
    const origin = headers.get("origin");
    const url = (origin || "http://" + (headers.get("host") || "localhost:8788")) + req.url;
    const response = await worker.fetch(
      new Request(url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
      }),
      {
        LOCAL_DEVELOPMENT: "true",
        ...localTwilio,
        DB: db,
        BUCKET: bucket,
        ASSETS: { fetch: async () => new Response("Vite serves the interface", { status: 404 }) },
      },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Erreur du serveur local" }));
  }
});
server.listen(8788, "127.0.0.1", () =>
  console.log("Foot Easy API local : http://127.0.0.1:8788 · sauvegarde .local-data"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    server.close();
    await build.dispose();
    database.close();
    process.exit(0);
  });
